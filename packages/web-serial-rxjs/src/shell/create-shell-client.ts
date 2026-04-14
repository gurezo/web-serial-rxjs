import {
  Observable,
  Subject,
  defaultIfEmpty,
  defer,
  firstValueFrom,
  shareReplay,
} from 'rxjs';
import type { SerialClient } from '../client';

export interface ShellClientOptions {
  prompt: string | RegExp;
  timeout?: number;
  retry?: number;
  lineEnding?: string;
}

export interface ShellExecResult {
  stdout: string;
}

export interface ShellClient {
  exec$(command: string): Observable<ShellExecResult>;
  readUntilPrompt$(): Observable<string>;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRY = 0;
const DEFAULT_LINE_ENDING = '\r\n';

class ShellClientImpl implements ShellClient {
  private readonly timeout: number;
  private readonly retry: number;
  private readonly lineEnding: string;
  private readonly prompt: string | RegExp;
  private readonly promptRegex: RegExp | null;
  private readonly bufferTick$ = new Subject<void>();
  private readonly read$: Observable<string>;
  private queueChain: Promise<void> = Promise.resolve();
  private readBuffer = '';

  constructor(
    private readonly client: SerialClient,
    options: ShellClientOptions,
  ) {
    this.prompt = options.prompt;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.retry = options.retry ?? DEFAULT_RETRY;
    this.lineEnding = options.lineEnding ?? DEFAULT_LINE_ENDING;
    this.promptRegex =
      this.prompt instanceof RegExp ? this.createAnchoredRegex(this.prompt) : null;
    this.read$ = this.client.text$.pipe(shareReplay(1));

    this.read$.subscribe({
      next: (chunk) => {
        this.readBuffer += chunk;
        this.bufferTick$.next();
      },
      error: (error) => this.bufferTick$.error(error),
      complete: () => this.bufferTick$.complete(),
    });
  }

  exec$(command: string): Observable<ShellExecResult> {
    return this.enqueue(async () => {
      for (let attempt = 0; attempt <= this.retry; attempt += 1) {
        try {
          await this.writeText(command + this.lineEnding);
          const stdout = await this.waitUntilPrompt(this.timeout);
          return { stdout };
        } catch (error) {
          if (!this.isTimeoutError(error) || attempt >= this.retry) {
            throw error;
          }
        }
      }

      throw new Error('Unexpected command execution state');
    });
  }

  readUntilPrompt$(): Observable<string> {
    return this.enqueue(async () => {
      for (let attempt = 0; attempt <= this.retry; attempt += 1) {
        try {
          return await this.waitUntilPrompt(this.timeout);
        } catch (error) {
          if (!this.isTimeoutError(error) || attempt >= this.retry) {
            throw error;
          }
        }
      }

      throw new Error('Unexpected prompt waiting state');
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Observable<T> {
    return defer(
      () =>
        new Observable<T>((subscriber) => {
          let cancelled = false;
          const run = async (): Promise<void> => {
            try {
              const value = await operation();
              if (!cancelled) {
                subscriber.next(value);
                subscriber.complete();
              }
            } catch (error) {
              if (!cancelled) {
                subscriber.error(error);
              }
            }
          };

          const scheduled = this.queueChain.then(run, run);
          this.queueChain = scheduled.then(
            () => undefined,
            () => undefined,
          );

          return () => {
            cancelled = true;
          };
        }),
    );
  }

  private async writeText(text: string): Promise<void> {
    await firstValueFrom(this.client.send$(text).pipe(defaultIfEmpty(undefined)));
  }

  private waitUntilPrompt(timeoutMs: number): Promise<string> {
    const immediate = this.tryConsumePrompt();
    if (immediate !== null) {
      return Promise.resolve(immediate);
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(`Timed out waiting for prompt after ${timeoutMs}ms`));
      }, timeoutMs);

      const complete = (value: string): void => {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve(value);
      };

      const fail = (error: unknown): void => {
        clearTimeout(timer);
        subscription.unsubscribe();
        reject(error);
      };

      const tryResolve = (): void => {
        const output = this.tryConsumePrompt();
        if (output !== null) {
          complete(output);
        }
      };

      const subscription = this.bufferTick$.subscribe({
        next: () => tryResolve(),
        error: (error) => fail(error),
        complete: () => fail(new Error('Read stream completed before prompt was found')),
      });
    });
  }

  private tryConsumePrompt(): string | null {
    if (typeof this.prompt === 'string') {
      if (
        this.readBuffer.length >= this.prompt.length &&
        this.readBuffer.endsWith(this.prompt)
      ) {
        const body = this.readBuffer.slice(0, this.readBuffer.length - this.prompt.length);
        this.readBuffer = '';
        return body.trimEnd();
      }
      return null;
    }

    if (!this.promptRegex) {
      return null;
    }

    const match = this.promptRegex.exec(this.readBuffer);
    if (!match || match.index == null) {
      return null;
    }

    const body = this.readBuffer.slice(0, match.index);
    this.readBuffer = '';
    return body.trimEnd();
  }

  private createAnchoredRegex(source: RegExp): RegExp {
    const flags = source.flags.replace(/g/g, '');
    return new RegExp(`(?:${source.source})$`, flags);
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Timed out waiting for prompt');
  }
}

export function createShellClient(
  client: SerialClient,
  options: ShellClientOptions,
): ShellClient {
  return new ShellClientImpl(client, options);
}
