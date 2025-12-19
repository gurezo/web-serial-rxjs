import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialError, SerialErrorCode } from '../../src/errors/serial-error';
import { readableToObservable } from '../../src/io/readable-to-observable';

describe('readableToObservable', () => {
  describe('successful conversion', () => {
    it('should convert ReadableStream to Observable', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      const values = await firstValueFrom(observable.pipe(toArray()));

      expect(values).toHaveLength(3);
      expect(values[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(values[1]).toEqual(new Uint8Array([4, 5, 6]));
      expect(values[2]).toEqual(new Uint8Array([7, 8, 9]));
    });

    it('should emit single chunk', async () => {
      const chunk = new Uint8Array([10, 20, 30]);

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      const value = await firstValueFrom(observable);

      expect(value).toEqual(chunk);
    });

    it('should complete when stream closes', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      const values = await firstValueFrom(observable.pipe(toArray()));

      expect(values).toHaveLength(0);
    });

    it('should handle empty stream', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      const values = await firstValueFrom(observable.pipe(toArray()));

      expect(values).toEqual([]);
    });

    it('should handle large number of chunks', async () => {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < 100; i++) {
        chunks.push(new Uint8Array([i]));
      }

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      const values = await firstValueFrom(observable.pipe(toArray()));

      expect(values).toHaveLength(100);
    });
  });

  describe('error handling', () => {
    it('should emit SerialError when stream errors', async () => {
      const error = new Error('Stream error');
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.error(error);
        },
      });

      const observable = readableToObservable(stream);

      await expect(firstValueFrom(observable.pipe(toArray()))).rejects.toThrow(
        SerialError,
      );

      try {
        await firstValueFrom(observable.pipe(toArray()));
        expect.fail('Should have thrown SerialError');
      } catch (err) {
        expect(err).toBeInstanceOf(SerialError);
        expect((err as SerialError).code).toBe(SerialErrorCode.READ_FAILED);
        expect((err as SerialError).message).toContain(
          'Failed to read from stream',
        );
        expect((err as SerialError).originalError).toBe(error);
      }
    });

    it('should emit SerialError when reader.read() throws', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
      });

      // Create a mock reader that throws
      const originalGetReader = stream.getReader.bind(stream);
      stream.getReader = () => {
        const reader = originalGetReader();
        const originalRead = reader.read.bind(reader);
        reader.read = () => {
          throw new Error('Read failed');
        };
        return reader;
      };

      const observable = readableToObservable(stream);

      try {
        await firstValueFrom(observable);
        expect.fail('Should have thrown SerialError');
      } catch (err) {
        expect(err).toBeInstanceOf(SerialError);
        expect((err as SerialError).code).toBe(SerialErrorCode.READ_FAILED);
      }
    });

    it('should handle non-Error exceptions', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
      });

      // Create a mock reader that throws a non-Error
      const originalGetReader = stream.getReader.bind(stream);
      stream.getReader = () => {
        const reader = originalGetReader();
        const originalRead = reader.read.bind(reader);
        reader.read = () => {
          throw 'String error';
        };
        return reader;
      };

      const observable = readableToObservable(stream);

      try {
        await firstValueFrom(observable);
        expect.fail('Should have thrown SerialError');
      } catch (err) {
        expect(err).toBeInstanceOf(SerialError);
        expect((err as SerialError).code).toBe(SerialErrorCode.READ_FAILED);
        expect((err as SerialError).message).toContain('Unknown error');
      }
    });
  });

  describe('cleanup', () => {
    it('should release reader lock on unsubscribe', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Never close to keep stream open
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
      });

      const observable = readableToObservable(stream);
      const subscription = observable.pipe(take(1)).subscribe();

      // Wait a bit for the subscription to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      subscription.unsubscribe();

      // Reader should be released, so we can get a new reader
      const newReader = stream.getReader();
      expect(newReader).toBeDefined();
      newReader.releaseLock();
    });

    it('should release reader lock on completion', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      const observable = readableToObservable(stream);
      await firstValueFrom(observable.pipe(toArray()));

      // Reader should be released, so we can get a new reader
      const newReader = stream.getReader();
      expect(newReader).toBeDefined();
      newReader.releaseLock();
    });

    it('should release reader lock on error', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('Test error'));
        },
      });

      const observable = readableToObservable(stream);

      try {
        await firstValueFrom(observable);
        expect.fail('Should have thrown');
      } catch {
        // Expected
      }

      // Reader should be released, so we can get a new reader
      const newReader = stream.getReader();
      expect(newReader).toBeDefined();
      newReader.releaseLock();
    });
  });
});
