# 開発ガイド

## 前提条件

- [Rust](https://rustup.rs/)
- [mise](https://mise.jdx.dev/) — Node.js バージョン管理に使用

## セットアップ

```sh
# mise をインストール（未インストールの場合）
curl https://mise.run | sh

# Node.js をインストール（.mise.toml の設定に従い自動でバージョンが選択される）
mise install

# pre-commit hook を有効化
mise run install-hook
```

### Pre-commit Hook

`mise run install-hook` を実行すると、`.githooks/pre-commit` が有効化されます。コミット時に以下のチェックが自動実行されます：

- **フロントエンド**: ステージされた変更ファイルに対して Prettier と ESLint をチェック
- **Rust**: `cargo fmt --check` でフォーマットをチェック

チェックに違反がある場合、コミットは中断されます。

## ビルド・テスト

### Rust（ライブラリ + アプリ）

```sh
cargo build                                # ワークスペース全体をビルド
cargo test                                 # 全テスト実行
cargo clippy --all-targets -- -D warnings  # リント（警告をエラーとして扱う）
```

### フロントエンド

```sh
cd frontend
npm ci                  # 依存関係インストール
npm run dev             # Vite 開発サーバー起動
npm run build           # TypeScript コンパイル + Vite ビルド
npm run lint            # ESLint チェック
npm run typecheck       # TypeScript 型チェック
npm run format          # Prettier フォーマット
```

### Visual Regression Test

[Playwright](https://playwright.dev/) と [Storybook](https://storybook.js.org/) を使ったビジュアルリグレッションテストを実施しています。UIコンポーネントのスクリーンショットを比較し、意図しない見た目の変更を検知します。

#### テスト実行

```sh
cd frontend

# Playwright ブラウザのインストール（初回のみ）
npx playwright install --with-deps chromium

# テスト実行（Storybook が自動起動します）
npm run test:vrt
```

#### スナップショットの更新

UIを意図的に変更した場合は、スナップショットを更新してください。

```sh
cd frontend
npm run test:vrt:update
```

更新された `frontend/e2e/vrt/__snapshots__/` 内の PNG ファイルをコミットに含めてください。

#### CI経由でのスナップショット更新

ローカル（macOS）と CI（Linux）ではフォント描画が異なるため、ローカルで生成したスナップショットが CI で一致しない場合があります。その場合は以下の方法で CI 上のスナップショットを更新できます：

1. PRに `update-snapshots` ラベルを付与する
2. GitHub Actions の「Update VRT Snapshots」ワークフローが自動実行される
3. Linux 環境で生成されたスナップショットがブランチにコミットされる

手動で実行する場合は、GitHub Actions の「Update VRT Snapshots」ワークフローを `workflow_dispatch` で起動してください。

#### 新しいコンポーネントにストーリーを追加する

1. `frontend/src/components/` にストーリーファイルを作成する（例: `MyComponent.stories.tsx`）
   ```tsx
   import type { Meta, StoryObj } from "@storybook/react";
   import { MyComponent } from "./MyComponent";

   const meta: Meta<typeof MyComponent> = {
     component: MyComponent,
   };
   export default meta;

   type Story = StoryObj<typeof MyComponent>;

   export const Default: Story = {};
   ```
2. `frontend/e2e/vrt/` に VRT スペックファイルを作成する（例: `my-component.spec.ts`）
   ```ts
   import { test, expect } from "@playwright/test";

   test.describe("MyComponent", () => {
     test("default", async ({ page }) => {
       await page.goto(
         "/iframe.html?id=mycomponent--default&viewMode=story",
       );
       await expect(page).toHaveScreenshot();
     });
   });
   ```
3. スナップショットを生成する
   ```sh
   cd frontend
   npm run test:vrt -- --update-snapshots
   ```
4. 生成された PNG ファイルをコミットに含める

#### CI での実行

PRを作成すると、GitHub Actions で自動的にビジュアルリグレッションテストが実行されます。差分が検出された場合は CI が失敗し、差分画像が `vrt-diff` アーティファクトとしてダウンロードできます。

### Tauri アプリ

```sh
cd app && cargo tauri dev     # 開発モード（ホットリロード付き）
cd app && cargo tauri build   # リリースビルド（.app バンドル生成）

# ビルドされた .app を起動
open app/target/release/bundle/macos/reown.app
```
