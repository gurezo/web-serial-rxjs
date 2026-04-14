import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { SerialClient } from '../../src/client';
import { createShellClient } from '../../src/shell';

function createMockClient(
  readSubject: Subject<string>,
  sendImpl: (text: string) => Observable<void>,
): SerialClient {
  return {
    requestPort: vi.fn(),
    getPorts: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    bytes$: of(new Uint8Array()),
    text$: readSubject.asObservable(),
    lines$: of(''),
    send$: sendImpl,
    command$: vi.fn(),
    transact$: vi.fn(),
    write: vi.fn(),
    writeText: vi.fn(),
    connected: true,
    connected$: of(true),
    state$: of({ kind: 'connected' }),
    errors$: new Subject(),
    currentPort: null,
  } as unknown as SerialClient;
}

describe('createShellClient', () => {
  it('reads until prompt with string matcher', async () => {
    const readSubject = new Subject<string>();
    const client = createMockClient(readSubject, () => of(undefined));
    const shell = createShellClient(client, { prompt: '$ ', timeout: 100 });

    const resultPromise = firstValueFrom(shell.readUntilPrompt$());
    readSubject.next('hello');
    readSubject.next(' world$ ');

    await expect(resultPromise).resolves.toBe('hello world');
  });

  it('retries command execution after timeout', async () => {
    const readSubject = new Subject<string>();
    let writeCount = 0;
    const client = createMockClient(readSubject, () => {
      writeCount += 1;
      if (writeCount === 2) {
        setTimeout(() => readSubject.next('ok$ '), 0);
      }
      return of(undefined);
    });
    const shell = createShellClient(client, {
      prompt: '$ ',
      timeout: 5,
      retry: 1,
    });

    const result = await firstValueFrom(shell.exec$('status'));

    expect(writeCount).toBe(2);
    expect(result.stdout).toBe('ok');
  });

  it('serializes concurrent exec calls with an internal queue', async () => {
    const readSubject = new Subject<string>();
    let firstPromptSent = false;
    let secondWriteBeforeFirstPrompt = false;
    const writes: string[] = [];

    const client = createMockClient(readSubject, (text) => {
      writes.push(text);
      if (text === 'b\r\n' && !firstPromptSent) {
        secondWriteBeforeFirstPrompt = true;
      }
      if (text === 'a\r\n') {
        setTimeout(() => {
          firstPromptSent = true;
          readSubject.next('A$ ');
        }, 20);
      }
      if (text === 'b\r\n') {
        setTimeout(() => {
          readSubject.next('B$ ');
        }, 0);
      }
      return of(undefined);
    });

    const shell = createShellClient(client, { prompt: '$ ', timeout: 200 });
    const [resultA, resultB] = await Promise.all([
      firstValueFrom(shell.exec$('a')),
      firstValueFrom(shell.exec$('b')),
    ]);

    expect(writes).toEqual(['a\r\n', 'b\r\n']);
    expect(secondWriteBeforeFirstPrompt).toBe(false);
    expect(resultA.stdout).toBe('A');
    expect(resultB.stdout).toBe('B');
  });
});
