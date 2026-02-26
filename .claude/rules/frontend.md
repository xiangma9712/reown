# Frontend Rules / フロントエンドルール

## Storybook & VRT

- コンポーネント（`frontend/src/components/*.tsx`）を修正・追加した場合、対応する Stories ファイル（`*.stories.tsx`）と VRT スペック（`frontend/e2e/vrt/*.spec.ts`）も更新すること
- 新規コンポーネントには必ず Stories + VRT を追加すること
- アニメーション系テスト（Loading, Spinner）には `maxDiffPixelRatio: 0.08` を設定すること
