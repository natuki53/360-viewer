// THREE変数はグローバルスコープから利用

// モジュールのインポート
import { PanoramaViewer } from './viewer-lib/panorama-viewer.js';

// ビューアーの初期化
document.addEventListener( 'DOMContentLoaded', function () {
	const containers = document.querySelectorAll( '.psv-container' );
	const viewers = new Map();

	containers.forEach( ( container ) => {
		const imageUrl = container.getAttribute( 'data-img' );
		if ( imageUrl ) {
			const viewer = new PanoramaViewer( container, imageUrl );
			viewers.set( container, viewer );
		}
	} );

	// ページ遷移時のクリーンアップ
	window.addEventListener( 'beforeunload', () => {
		viewers.forEach( ( viewer ) => viewer.dispose() );
		viewers.clear();
	} );

	// SPA環境などでコンテナが DOM から動的に削除された場合のクリーンアップ
	// （beforeunload が発火しないケースに対応）
	const mutationObserver = new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			mutation.removedNodes.forEach( ( node ) => {
				if ( ! ( node instanceof Element ) ) return;
				viewers.forEach( ( viewer, container ) => {
					if ( node === container || node.contains( container ) ) {
						viewer.dispose();
						viewers.delete( container );
					}
				} );
			} );
		} );
	} );

	mutationObserver.observe( document.body, {
		childList: true,
		subtree: true,
	} );
} );
