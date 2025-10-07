# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-01-XX

### Fixed
- 重大なメモリリーク問題を修正（イベントリスナーの正しい削除）
- テクスチャ読み込みエラーハンドラーを追加
- ボタンのイベントハンドラーを正しく削除するように修正
- Three.jsの非推奨API（encoding）をcolorSpaceに更新
- autoRotateTimeoutとpreventScrollのクリーンアップを追加
- WebGLコンテキスト損失時の処理を追加
- Canvas2Dフォールバックでの実際の画像色取得を修正
- style.scssの文字化けを修正
- バージョン番号を統一（1.0.1に統一）
- 重複しているeditor.jsを削除

### Added
- デバッグモード（DEBUG_MODE）による開発/本番環境の切り替え
- WebGLコンテキスト損失/復元イベントハンドラー
- より詳細なデバイス判定（Mac対応改善）
- ハードウェアアクセラレーション検出機能

### Changed
- イベントリスナーの管理方法を改善（バインド済みメソッドの保存）
- Three.jsのバージョン互換性を向上
- エラーハンドリングの強化

## [1.0.0] - 2024-01-XX

### Added
- モバイル対応の強化
- ピンチズーム機能の追加
- パフォーマンス最適化
- 基本的な360°ビューアー機能
- Three.jsを使用したWebGLレンダリング
- Canvas2Dフォールバック対応
- フルスクリーン表示機能
- ズームイン/アウト機能
- 自動回転機能
