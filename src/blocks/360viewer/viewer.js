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
} );
