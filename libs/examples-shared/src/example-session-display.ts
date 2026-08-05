import {
  SerialSessionStatus,
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import {
  formatExampleSerialError,
  type ExampleErrorDisplay,
} from './example-requirements';

export interface ExampleSessionStatusDisplay {
  /** Raw `state.status` value. */
  readonly status: SerialSessionState['status'];
  /** Japanese label for the status. */
  readonly label: string;
  /** Combined display like `idle（アイドル）`. */
  readonly display: string;
  /** True while connect or disconnect is in progress. */
  readonly inProgress: boolean;
}

export interface ExamplePortInfoDisplay {
  readonly vendorId: string;
  readonly productId: string;
  readonly display: string;
}

export interface ExampleSerialErrorDetail extends ExampleErrorDisplay {
  readonly code: string;
  readonly contextSummary: string | null;
}

export interface ExampleControlsEnabled {
  readonly connect: boolean;
  readonly disconnect: boolean;
  readonly send: boolean;
}

const STATUS_LABELS: Record<SerialSessionState['status'], string> = {
  [SerialSessionStatus.Idle]: 'アイドル',
  [SerialSessionStatus.Connecting]: '接続中',
  [SerialSessionStatus.Connected]: '接続済み',
  [SerialSessionStatus.Disconnecting]: '切断中',
  [SerialSessionStatus.Unsupported]: '非対応',
  [SerialSessionStatus.Error]: 'エラー',
  [SerialSessionStatus.Disposed]: '破棄済み',
};

/**
 * Formats a {@link SerialSessionState} for Example UI status panels.
 */
export function formatExampleSessionStatus(
  state: SerialSessionState,
): ExampleSessionStatusDisplay {
  const status = state.status;
  const label = STATUS_LABELS[status];
  const inProgress =
    status === SerialSessionStatus.Connecting ||
    status === SerialSessionStatus.Disconnecting;

  return {
    status,
    label,
    display: `${status}（${label}）`,
    inProgress,
  };
}

function formatUsbId(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '不明';
  }
  return `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Formats USB Vendor / Product IDs from {@link SerialPortInfo}.
 */
export function formatExamplePortInfo(
  portInfo: SerialPortInfo,
): ExamplePortInfoDisplay {
  const vendorId = formatUsbId(portInfo.usbVendorId);
  const productId = formatUsbId(portInfo.usbProductId);

  return {
    vendorId,
    productId,
    display: `Vendor ID: ${vendorId} / Product ID: ${productId}`,
  };
}

function summarizeContext(context: unknown): string | null {
  if (context === undefined || context === null) {
    return null;
  }

  if (typeof context !== 'object') {
    return String(context);
  }

  const record = context as Record<string, unknown>;
  const parts: string[] = [];

  if ('cause' in record) {
    const cause = record.cause;
    if (cause instanceof Error) {
      parts.push(`cause: ${cause.name}: ${cause.message}`);
    } else if (cause !== undefined && cause !== null) {
      parts.push(`cause: ${String(cause)}`);
    }
  }

  if (typeof record.maxChars === 'number') {
    parts.push(`maxChars: ${record.maxChars}`);
  }

  if (typeof record.field === 'string') {
    parts.push(`field: ${record.field}`);
  }
  if ('value' in record) {
    parts.push(`value: ${String(record.value)}`);
  }
  if (typeof record.constraint === 'string') {
    parts.push(`constraint: ${record.constraint}`);
  }
  if (typeof record.filterIndex === 'number') {
    parts.push(`filterIndex: ${record.filterIndex}`);
  }

  if (parts.length === 0) {
    try {
      return JSON.stringify(context);
    } catch {
      return String(context);
    }
  }

  return parts.join(', ');
}

/**
 * Maps a {@link SerialError} to Example detail fields (message, code, context).
 * Port-selection cancel remains an info tone via {@link formatExampleSerialError}.
 */
export function formatExampleSerialErrorDetail(
  error: SerialError,
): ExampleSerialErrorDetail {
  const base = formatExampleSerialError(error);
  const code =
    typeof error.code === 'string' ? error.code : String(error.code ?? 'UNKNOWN');

  return {
    ...base,
    code,
    contextSummary: summarizeContext(error.context),
  };
}

/**
 * Derives Connect / Disconnect / Send enabled flags from session state
 * and browser support (`canConnect` from {@link getExampleSupportStatus}).
 */
export function getExampleControlsEnabled(
  state: SerialSessionState,
  canConnect: boolean,
): ExampleControlsEnabled {
  const status = state.status;
  const connected = status === SerialSessionStatus.Connected;
  const connecting = status === SerialSessionStatus.Connecting;
  const disconnecting = status === SerialSessionStatus.Disconnecting;
  const disposed = status === SerialSessionStatus.Disposed;
  const unsupported = status === SerialSessionStatus.Unsupported;

  return {
    connect:
      canConnect &&
      !connected &&
      !connecting &&
      !disconnecting &&
      !disposed &&
      !unsupported,
    disconnect: connected && !disconnecting,
    send: connected && !disconnecting,
  };
}
