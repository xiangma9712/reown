# Frontend Rules / フロントエンドルール

## Storybook & VRT

- コンポーネント（`frontend/src/components/*.tsx`）を修正・追加した場合、対応する Stories ファイル（`*.stories.tsx`）と VRT スペック（`frontend/e2e/vrt/*.spec.ts`）も更新すること
- 新規コンポーネントには必ず Stories + VRT を追加すること
- アニメーション系テスト（Loading, Spinner）には `maxDiffPixelRatio: 0.08` を設定すること

## PR作成時

- PRには必ず `update-snapshots` ラベルを付与すること — ローカル（macOS）と CI（Linux）でフォント描画が異なるため、CI上でスナップショットを再生成する必要がある
- `gh pr create` 後に `gh pr edit <number> --add-label update-snapshots` を実行する
