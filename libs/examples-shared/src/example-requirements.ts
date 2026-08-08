import {
  isWebSerialSupported,
  SerialErrorCode,
  type SerialError,
} from '@gurezo/web-serial-rxjs';

export interface ExampleRequirementsCopy {
  title: string;
  items: readonly string[];
}

export type ExampleUnsupportedReason =
  | 'none'
  | 'no-web-serial'
  | 'insecure-context'
  | 'both';

export interface ExampleSupportStatus {
  apiSupported: boolean;
  secureContext: boolean;
  canConnect: boolean;
  unsupportedReason: ExampleUnsupportedReason;
  statusMessage: string;
  statusType: 'success' | 'error';
}

export interface ExampleErrorDisplay {
  type: 'info' | 'error';
  message: string;
}

const CANCEL_MESSAGE =
  'ポート選択がキャンセルされました。再度『接続』を押してポートを選んでください。';

const RECOMMENDED_BROWSERS =
  '公式サポート対象のデスクトップブラウザ（Chrome 89+、Edge 89+、Opera 75+、Firefox 151+）をご使用ください。Safari は Web Serial API 未実装です。モバイルは未検証・公式サポート対象外です。';

/**
 * Static copy for the Example “利用条件” panel (Japanese UI).
 */
export function getExampleRequirementsCopy(): ExampleRequirementsCopy {
  return {
    title: '利用条件',
    items: [
      'ページは HTTPS または localhost（セキュアコンテキスト）で開いてください。',
      '「接続」はユーザー操作（ボタンクリック）から実行してください。そうでないとポート選択ダイアログが開きません。',
      'Web Serial の公式サポート対象はデスクトップブラウザです（Chrome 89+、Edge 89+、Opera 75+、Firefox 151+）。モバイルは未検証です。実機のシリアルデバイス（または互換アダプタ）が必要です。',
    ],
  };
}

function resolveUnsupportedReason(
  apiSupported: boolean,
  secureContext: boolean,
): ExampleUnsupportedReason {
  if (apiSupported && secureContext) {
    return 'none';
  }
  if (!apiSupported && !secureContext) {
    return 'both';
  }
  if (!apiSupported) {
    return 'no-web-serial';
  }
  return 'insecure-context';
}

function statusMessageFor(reason: ExampleUnsupportedReason): string {
  switch (reason) {
    case 'none':
      return 'ブラウザは Web Serial API をサポートしており、セキュアコンテキストで実行中です。';
    case 'no-web-serial':
      return `このブラウザは Web Serial API をサポートしていません。${RECOMMENDED_BROWSERS}`;
    case 'insecure-context':
      return 'セキュアコンテキストではありません。HTTPS または localhost でページを開いてください。';
    case 'both':
      return `Web Serial を利用できません。セキュアコンテキスト（HTTPS / localhost）で、対応ブラウザを使用してください。${RECOMMENDED_BROWSERS}`;
  }
}

/**
 * Runtime support status for Example UIs (API + secure context).
 */
export function getExampleSupportStatus(): ExampleSupportStatus {
  const apiSupported = isWebSerialSupported();
  const secureContext =
    typeof window !== 'undefined' && window.isSecureContext === true;
  const unsupportedReason = resolveUnsupportedReason(
    apiSupported,
    secureContext,
  );
  const canConnect = unsupportedReason === 'none';

  return {
    apiSupported,
    secureContext,
    canConnect,
    unsupportedReason,
    statusMessage: statusMessageFor(unsupportedReason),
    statusType: canConnect ? 'success' : 'error',
  };
}

/**
 * Maps a {@link SerialError} to Example status copy.
 * Port-selection cancel is shown as info, not as a hard error.
 */
export function formatExampleSerialError(
  error: SerialError,
): ExampleErrorDisplay {
  const isCancelled =
    typeof error.is === 'function'
      ? error.is(SerialErrorCode.OPERATION_CANCELLED)
      : error.code === SerialErrorCode.OPERATION_CANCELLED;

  if (isCancelled) {
    return {
      type: 'info',
      message: CANCEL_MESSAGE,
    };
  }

  return {
    type: 'error',
    message: error.message,
  };
}
