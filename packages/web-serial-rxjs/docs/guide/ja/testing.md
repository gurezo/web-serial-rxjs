# Fake SerialSession による実機なしテスト

USB シリアル実機は自動テストに向きません。CI にデバイスを付けられず、権限拒否・遅延受信・突然の切断といった失敗も再現しづらいためです。本 Recipe では、Web Serial API を呼ばずに **`SerialSession` に依存するアプリケーションコード** をテストする方法を示します。

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#537](https://github.com/gurezo/web-serial-rxjs/issues/537) · 関連: [通信パターン別 Recipes](./recipes.md) · 契約: [差し替え可能な公開契約（Decision #536）](./concepts.md#差し替え可能な公開契約decision-536)

## スコープと npm 同梱の判断

| 項目 | 判断 |
| --- | --- |
| Fake の目的 | アプリテスト向けに `SerialSession` 面（`state$` / `errors$` / `receive$` / `lines$` / `send$` など）を駆動する |
| Web Serial API | **モック・再現しない** |
| npm パッケージ | **同梱しない** — Fake は `@gurezo/web-serial-rxjs` の export ではない |
| 使い方 | 下のヘルパーをテストツリーへコピーするか、同等の Fake をアプリ側で定義する |
| リポジトリ参照 | [`tests/helpers/fake-serial-session.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/fake-serial-session.ts)（CI 用の例。公開物ではない） |

[Request / Response](./request-response.md) や [タイムアウト・キャンセル・再試行](./timeout-cancel-retry.md) で共有ヘルパーの必要性が固まった場合に、将来 `@gurezo/web-serial-rxjs/testing` などを検討します。それまでは公開面を小さく保ちます。

## 依存の差し替えパターン

アプリケーションコードは `SerialSession` 型に依存し、`createSerialSession()` は Composition root でのみ呼び出します。テストでは代わりに `fake.session` を渡します。

```typescript
import {
  createSerialSession,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';

// アプリ層: SerialSession だけを受け取る
function createSerialUi(session: SerialSession) {
  return session.state$.subscribe((state) => {
    // state.status から UI 更新
  });
}

// 本番境界
createSerialUi(createSerialSession({ baudRate: 115200 }));

// テスト境界
// createSerialUi(fake.session);
```

## 制御可能な Fake ヘルパー（コピー用）

```typescript
import {
  BehaviorSubject,
  Observable,
  Subject,
  defer,
  of,
  throwError,
} from 'rxjs';
import {
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialPayload,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';

const DEFAULT_PORT_INFO: SerialPortInfo = {
  usbVendorId: 0x1234,
  usbProductId: 0x5678,
};

export type FakeSerialSessionHandle = {
  session: SerialSession;
  readonly sent: readonly SerialPayload[];
  setState(state: SerialSessionState): void;
  emitReceive(chunk: string): void;
  emitLine(line: string): void;
  emitError(error: SerialError): void;
  failNextConnect(error?: SerialError): void;
  failNextSend(error?: SerialError): void;
  simulateDeviceDisconnect(error?: SerialError): void;
};

export function createFakeSerialSession(): FakeSerialSessionHandle {
  const stateSubject = new BehaviorSubject<SerialSessionState>({
    status: SerialSessionStatus.Idle,
  });
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const terminalTextSubject = new BehaviorSubject<string>('');

  const sent: SerialPayload[] = [];
  let nextConnectError: SerialError | undefined;
  let nextSendError: SerialError | undefined;

  const session: SerialSession = {
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    lines$: linesSubject.asObservable(),
    terminalText$: terminalTextSubject.asObservable(),

    connect$: (): Observable<void> =>
      defer(() => {
        if (nextConnectError !== undefined) {
          const error = nextConnectError;
          nextConnectError = undefined;
          stateSubject.next({ status: SerialSessionStatus.Connecting });
          stateSubject.next({ status: SerialSessionStatus.Idle });
          errorsSubject.next(error);
          return throwError(() => error);
        }
        stateSubject.next({ status: SerialSessionStatus.Connecting });
        stateSubject.next({
          status: SerialSessionStatus.Connected,
          portInfo: DEFAULT_PORT_INFO,
        });
        return of(undefined);
      }),

    disconnect$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disconnecting });
        stateSubject.next({ status: SerialSessionStatus.Idle });
        return of(undefined);
      }),

    dispose$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disposed });
        return of(undefined);
      }),

    send$: (data: SerialPayload): Observable<void> =>
      defer(() => {
        sent.push(data);
        if (nextSendError !== undefined) {
          const error = nextSendError;
          nextSendError = undefined;
          errorsSubject.next(error);
          return throwError(() => error);
        }
        return of(undefined);
      }),
  };

  return {
    session,
    get sent() {
      return sent;
    },
    setState(state) {
      stateSubject.next(state);
    },
    emitReceive(chunk) {
      receiveSubject.next(chunk);
      terminalTextSubject.next(terminalTextSubject.value + chunk);
    },
    emitLine(line) {
      linesSubject.next(line);
    },
    emitError(error) {
      errorsSubject.next(error);
    },
    failNextConnect(
      error = new SerialError(
        SerialErrorCode.PORT_OPEN_FAILED,
        'Fake connect failed',
      ),
    ) {
      nextConnectError = error;
    },
    failNextSend(
      error = new SerialError(SerialErrorCode.WRITE_FAILED, 'Fake send failed'),
    ) {
      nextSendError = error;
    },
    simulateDeviceDisconnect(
      error = new SerialError(
        SerialErrorCode.CONNECTION_LOST,
        'Fake device disconnected',
      ),
    ) {
      stateSubject.next({ status: SerialSessionStatus.Idle });
      errorsSubject.next(error);
    },
  };
}
```

### 制御 API

| メソッド / フィールド | 用途 |
| --- | --- |
| `session` | `SerialSession` 型のアプリコードへ注入 |
| `sent` | `send$` に渡したペイロードを検証 |
| `setState` | 任意のライフサイクル状態を強制 |
| `emitReceive` / `emitLine` | チャンク / 行を投入（独立ストリーム） |
| `emitError` | `errors$` へ `SerialError` を通知 |
| `failNextConnect` / `failNextSend` | 次の `connect$` / `send$` を失敗させる |
| `simulateDeviceDisconnect` | `idle` へ戻し、既定では `CONNECTION_LOST` を通知 |

## フレームワーク非依存の Vitest 例

```typescript
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { createFakeSerialSession } from './fake-serial-session';

describe('app serial flow (no hardware)', () => {
  it('connects', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());
    await expect(firstValueFrom(fake.session.state$)).resolves.toMatchObject({
      status: SerialSessionStatus.Connected,
    });
  });

  it('records send payloads', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.send$('AT\r\n'));
    expect(fake.sent).toEqual(['AT\r\n']);
  });

  it('feeds receive data into UI logic', async () => {
    const fake = createFakeSerialSession();
    const chunks: string[] = [];
    fake.session.receive$.subscribe((c) => chunks.push(c));
    fake.emitReceive('OK\r\n');
    expect(chunks).toEqual(['OK\r\n']);
  });
});
```

ライブラリリポジトリ内の CI 実行可能なシナリオ網羅は次です。

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/fake-serial-session.test.ts
```

## Angular: `SerialSession` を注入する

```typescript
import { InjectionToken, Injectable, inject } from '@angular/core';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

export const SERIAL_SESSION = new InjectionToken<SerialSession>('SERIAL_SESSION');

export const serialSessionProvider = {
  provide: SERIAL_SESSION,
  useFactory: () => createSerialSession({ baudRate: 115200 }),
};

@Injectable()
export class SerialClientService {
  private readonly session = inject(SERIAL_SESSION);

  connect() {
    return this.session.connect$();
  }

  readonly state$ = this.session.state$;
}
```

最小テスト例:

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { SERIAL_SESSION, SerialClientService } from './serial-client.service';
import { createFakeSerialSession } from './fake-serial-session';

it('exposes connected state without hardware', async () => {
  const fake = createFakeSerialSession();
  TestBed.configureTestingModule({
    providers: [
      SerialClientService,
      { provide: SERIAL_SESSION, useValue: fake.session },
    ],
  });
  const service = TestBed.inject(SerialClientService);
  await firstValueFrom(service.connect());
  await expect(firstValueFrom(service.state$)).resolves.toMatchObject({
    status: SerialSessionStatus.Connected,
  });
});
```

## React: `SerialSession` 型の Context

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import {
  createSerialSession,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';

const SerialSessionContext = createContext<SerialSession | null>(null);

export function SerialSessionProvider({ children }: { children: ReactNode }) {
  // マウントごとに一度だけ生成するよう useRef / useState を推奨
  const session = createSerialSession({ baudRate: 115200 });
  return (
    <SerialSessionContext.Provider value={session}>
      {children}
    </SerialSessionContext.Provider>
  );
}

export function useSerialSession(): SerialSession {
  const session = useContext(SerialSessionContext);
  if (!session) {
    throw new Error('SerialSessionProvider is required');
  }
  return session;
}
```

最小テスト例（Provider 経由で Fake を注入）:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { firstValueFrom } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { createFakeSerialSession } from './fake-serial-session';
import { SerialSessionContext, useSerialSession } from './serial-session-context';

it('reads connected state from Fake', async () => {
  const fake = createFakeSerialSession();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SerialSessionContext.Provider value={fake.session}>
      {children}
    </SerialSessionContext.Provider>
  );
  const { result } = renderHook(() => useSerialSession(), { wrapper });
  await firstValueFrom(result.current.connect$());
  await waitFor(async () => {
    const state = await firstValueFrom(result.current.state$);
    expect(state.status).toBe(SerialSessionStatus.Connected);
  });
});
```

## 関連

- [通信パターン別 Recipes](./recipes.md) — パターン → Guide 索引
- [差し替え可能な公開契約](./concepts.md#差し替え可能な公開契約decision-536)
- [高度な使用方法](./advanced-usage.md) — `receive$` / `send$` 上の RxJS 組み立て
- [Request / Response レシピ](./request-response.md) — コマンド送信後の応答待ち（#538）
- [タイムアウト・キャンセル・再試行](./timeout-cancel-retry.md) — 期限、破棄時キャンセル、回数制限付き再試行（#539）
