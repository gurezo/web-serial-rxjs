import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from './App.svelte';

describe('App', () => {
  it('should render', () => {
    const { container } = render(App);
    expect(container).toBeTruthy();
  });

  it('should display the title', () => {
    const { getByText } = render(App);
    expect(getByText('Web Serial RxJS - Svelte Example')).toBeTruthy();
  });

  it('should display browser support section', () => {
    const { getByText } = render(App);
    expect(getByText('ブラウザサポート')).toBeTruthy();
  });

  it('should display connection settings section', () => {
    const { getByText } = render(App);
    expect(getByText('接続設定')).toBeTruthy();
  });

  it('should display data sending section', () => {
    const { getByText } = render(App);
    expect(getByText('データ送信')).toBeTruthy();
  });

  it('should display data receiving section', () => {
    const { getByText } = render(App);
    expect(getByText('データ受信')).toBeTruthy();
  });
});
