# 360 Viewer ライブラリモジュール

viewer.jsを可読性と拡張性向上のために複数のモジュールに分割しました。

## モジュール構成

### 1. `device-detection.js`
**役割**: デバイス検出とシステム情報の取得

- `getGlobalDeviceInfo()` - グローバルなデバイス情報を取得
- `detectMobileDevice()` - モバイルデバイスの検出
- `detectWebGLSupport()` - WebGLサポートの確認
- `detectDevicePerformanceLevel()` - デバイス性能レベルの判定（high/medium/low）
- `detectHardwareAcceleration()` - ハードウェアアクセラレーションの検出
- `getBrowserInfo()` - ブラウザ情報の取得

### 2. `webgl-config.js`
**役割**: WebGLレンダラーの設定管理

- `getGlobalWebGLConfig()` - デバイスに応じたWebGL設定を取得
- `getSphereGeometryConfig()` - 球体ジオメトリの解像度設定を取得
- `configureTextureFilters()` - テクスチャフィルター設定の適用

### 3. `canvas2d-renderer.js`
**役割**: Canvas2Dフォールバックレンダラー

- `createCanvas2DRenderer()` - Canvas2Dレンダラーの作成
- `showErrorMessage()` - エラーメッセージの表示（iアイコン）
- 内部関数:
  - `renderCanvas2D()` - Canvas2Dでの描画処理
  - `drawPanoramaOnCanvas()` - パノラマの球面投影描画
  - `showDetailedError()` - 詳細エラーメッセージの表示

### 4. `event-handlers.js`
**役割**: イベントハンドラーの管理

`EventHandlers`クラス:
- マウスイベント処理（mousedown, mousemove, mouseup）
- タッチイベント処理（touchstart, touchmove, touchend）
- ウィンドウリサイズ処理
- 自動回転の制御
- カーソルの更新

### 5. `fullscreen-manager.js`
**役割**: フルスクリーン機能の管理

`FullscreenManager`クラス:
- `toggleFullscreen()` - フルスクリーンの切り替え
- `enterFullscreen()` - フルスクリーンに入る
- `exitFullscreen()` - フルスクリーンを終了
- `tryTrueFullscreen()` - ブラウザのフルスクリーンAPIを試行
- `tryAlternativeFullscreen()` - 代替フルスクリーンモード
- ESCキーやフルスクリーン状態変更のイベント処理

### 6. `ui-controls.js`
**役割**: UIコントロール（ボタン）の管理

`UIControls`クラス:
- `createControls()` - コントロールボタンの作成
- `createZoomButtons()` - ズームボタンの作成
- `createFullscreenButton()` - フルスクリーンボタンの作成
- `zoomIn()` / `zoomOut()` - ズーム処理
- ボタンイベントの管理

### 7. `viewer-core.js`
**役割**: ビューアーのコア機能

`ViewerCore`クラス:
- `initializeThreeJS()` - Three.jsの初期化
- `createSphere()` - 球体ジオメトリとテクスチャの作成
- `createRenderer()` - レンダラーの作成
- `handleContextLost()` / `handleContextRestored()` - WebGLコンテキストの管理
- `switchToCanvas2D()` - Canvas2Dへの切り替え
- `activate()` / `deactivate()` - ビューアーのアクティブ化
- `startAnimation()` / `stopAnimation()` - アニメーションの制御
- `animate()` / `update()` - アニメーションループ
- `dispose()` - リソースの解放

### 8. `panorama-viewer.js`
**役割**: メインのビューアークラス

`PanoramaViewer`クラス:
- すべてのモジュールを統合
- ビューアーの初期化とセットアップ
- 各モジュールのインスタンス管理
- `init()` - 初期化処理
- `dispose()` - リソースの解放

## エントリーポイント

### `../viewer.js`
最終的なエントリーポイント。PanoramaViewerをインポートして初期化します。

```javascript
import { PanoramaViewer } from './viewer-lib/panorama-viewer.js';

document.addEventListener('DOMContentLoaded', function() {
    const containers = document.querySelectorAll('.psv-container');
    const viewers = new Map();

    containers.forEach(container => {
        const imageUrl = container.getAttribute('data-img');
        if (imageUrl) {
            const viewer = new PanoramaViewer(container, imageUrl);
            viewers.set(container, viewer);
        }
    });

    window.addEventListener('beforeunload', () => {
        viewers.forEach(viewer => viewer.dispose());
        viewers.clear();
    });
});
```

## メリット

1. **可読性の向上**: 各モジュールが特定の責任を持ち、コードが理解しやすくなりました
2. **保守性の向上**: 変更が必要な場合、該当するモジュールのみを編集できます
3. **テスト容易性**: 各モジュールを個別にテストできます
4. **拡張性**: 新機能を追加する際、適切なモジュールに追加するか、新しいモジュールを作成できます
5. **再利用性**: 各モジュールを他のプロジェクトでも利用できます

## 機能の変更なし

元のviewer.jsの機能はすべて保持されており、動作は完全に同一です。

