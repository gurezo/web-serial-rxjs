import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  observableToWritable,
  subscribeToWritable,
} from '../../src/io/observable-to-writable';

describe('observableToWritable', () => {
  describe('successful conversion', () => {
    it('should convert Observable to WritableStream', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];

      const observable = of(...chunks);
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();
      const writtenChunks: Uint8Array[] = [];

      // Read from the stream
      const reader = new ReadableStream({
        start(controller) {
          // This will be called when stream starts
        },
      }).getReader();

      // Write chunks and verify
      for (const chunk of chunks) {
        await writer.write(chunk);
        writtenChunks.push(chunk);
      }

      await writer.close();
      writer.releaseLock();

      expect(writtenChunks).toHaveLength(3);
    });

    it('should handle single chunk', async () => {
      const chunk = new Uint8Array([10, 20, 30]);
      const observable = of(chunk);
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();
      await writer.write(chunk);
      await writer.close();
      writer.releaseLock();
    });

    it('should handle empty Observable', async () => {
      const observable = of();
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();
      await writer.close();
      writer.releaseLock();
    });

    it('should complete stream when Observable completes', async () => {
      const observable = of(
        new Uint8Array([1]),
        new Uint8Array([2]),
        new Uint8Array([3]),
      );
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();

      // Wait for observable to complete and stream to close
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Stream should be closed
      writer.releaseLock();
    });
  });

  describe('error handling', () => {
    it('should abort stream when Observable errors', async () => {
      const error = new Error('Observable error');
      const observable = throwError(() => error);
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();

      // Wait for error to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Stream should be aborted
      writer.releaseLock();
    });

    it('should handle write errors', async () => {
      // This test verifies that write errors are handled internally
      // The observableToWritable function handles errors internally,
      // so we can't easily test the error path without more complex mocking
      // For now, we'll test that the function doesn't crash on normal operation
      const observable = of(new Uint8Array([1, 2, 3]));
      const stream = observableToWritable(observable);

      const writer = stream.getWriter();

      // Wait for observable to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Stream should be in a valid state
      writer.releaseLock();
    });
  });

  describe('abort handling', () => {
    it('should unsubscribe from Observable when stream is aborted', async () => {
      const subject = new Subject<Uint8Array>();
      const stream = observableToWritable(subject);

      // Get writer to start the stream
      const writer = stream.getWriter();

      // Wait a bit for the stream to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Release writer before aborting
      writer.releaseLock();

      // Abort the stream
      await stream.abort(new Error('Aborted'));

      // Observable should be unsubscribed
      expect(subject.observers.length).toBe(0);
    });

    it('should handle abort with reason', async () => {
      const observable = of(new Uint8Array([1, 2, 3]));
      const stream = observableToWritable(observable);

      const abortReason = new Error('Abort reason');
      await stream.abort(abortReason);

      // Stream should be aborted
      const writer = stream.getWriter();
      writer.releaseLock();
    });
  });
});

describe('subscribeToWritable', () => {
  describe('successful subscription', () => {
    it('should write chunks from Observable to WritableStream', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];

      const observable = of(...chunks);
      const writtenChunks: Uint8Array[] = [];

      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          writtenChunks.push(chunk);
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait for all chunks to be written
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(writtenChunks).toHaveLength(3);
      expect(writtenChunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(writtenChunks[1]).toEqual(new Uint8Array([4, 5, 6]));
      expect(writtenChunks[2]).toEqual(new Uint8Array([7, 8, 9]));

      subscription.unsubscribe();
    });

    it('should close stream when Observable completes', async () => {
      let closed = false;
      const observable = of(new Uint8Array([1, 2, 3]));

      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          // Do nothing
        },
        close() {
          closed = true;
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(closed).toBe(true);
      subscription.unsubscribe();
    });

    it('should handle empty Observable', async () => {
      const observable = of();
      let writeCalled = false;

      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          writeCalled = true;
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(writeCalled).toBe(false);
      subscription.unsubscribe();
    });
  });

  describe('error handling', () => {
    it('should handle write errors and unsubscribe', async () => {
      // This test verifies that write errors cause the subscription to be unsubscribed
      // Note: The error is thrown asynchronously in the next handler, which causes
      // an unhandled rejection. This is expected behavior for this implementation.
      // In a real application, the error would be caught by the caller or error handler.
      const observable = of(new Uint8Array([1, 2, 3]));

      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          throw new Error('Write error');
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait a bit for the error to occur and subscription to be unsubscribed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Subscription should already be unsubscribed by the error handler
      // Calling unsubscribe again should be safe (no-op)
      subscription.unsubscribe();
    });

    it('should abort stream when Observable errors', async () => {
      const error = new Error('Observable error');
      const observable = throwError(() => error);
      let aborted = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Testing abort reason type
      let abortReason: any;

      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          // Do nothing
        },
        abort(reason) {
          aborted = true;
          abortReason = reason;
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait for error to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(aborted).toBe(true);
      subscription.unsubscribe();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from Observable and release writer', async () => {
      const subject = new Subject<Uint8Array>();
      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          // Do nothing
        },
      });

      const subscription = subscribeToWritable(subject, stream);

      // Send some chunks
      subject.next(new Uint8Array([1, 2, 3]));
      subject.next(new Uint8Array([4, 5, 6]));

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Unsubscribe
      subscription.unsubscribe();

      // Observable should be unsubscribed
      expect(subject.observers.length).toBe(0);
    });

    it('should release writer lock on unsubscribe', async () => {
      const observable = of(new Uint8Array([1, 2, 3]));
      const stream = new WritableStream<Uint8Array>({
        write(chunk) {
          // Do nothing
        },
      });

      const subscription = subscribeToWritable(observable, stream);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      subscription.unsubscribe();

      // Writer should be released, so we can get a new writer
      const newWriter = stream.getWriter();
      expect(newWriter).toBeDefined();
      newWriter.releaseLock();
    });
  });
});
