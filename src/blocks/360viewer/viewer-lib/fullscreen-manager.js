import { DEBUG_MODE } from './debug-config.js';

/**
 * フルスクリーン機能を管理するクラス
 */
export class FullscreenManager {
	constructor( viewer ) {
		this.viewer = viewer;
		this.isFullscreen = false;

		// バインド済みメソッドを保存
		this.boundHandleFullscreenChange =
			this.handleFullscreenChange.bind( this );
		this.boundHandleEscapeKey = this.handleEscapeKey.bind( this );
		this.boundPreventScroll = this.preventScroll.bind( this );
	}

	/**
	 * フルスクリーン関連のイベントリスナーを設定する
	 */
	setupEventListeners() {
		if ( this.viewer.isMobile ) return;

		document.addEventListener(
			'fullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.addEventListener(
			'webkitfullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.addEventListener(
			'mozfullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.addEventListener(
			'MSFullscreenChange',
			this.boundHandleFullscreenChange
		);
		document.addEventListener( 'keydown', this.boundHandleEscapeKey );
	}

	/**
	 * フルスクリーン関連のイベントリスナーを削除する
	 */
	removeEventListeners() {
		if ( this.viewer.isMobile ) return;

		document.removeEventListener(
			'fullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.removeEventListener(
			'webkitfullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.removeEventListener(
			'mozfullscreenchange',
			this.boundHandleFullscreenChange
		);
		document.removeEventListener(
			'MSFullscreenChange',
			this.boundHandleFullscreenChange
		);
		document.removeEventListener( 'keydown', this.boundHandleEscapeKey );
		document.removeEventListener( 'touchmove', this.boundPreventScroll );
	}

	/**
	 * フルスクリーンを切り替える
	 */
	toggleFullscreen() {
		if ( this.viewer.isMobile ) return;

		if ( DEBUG_MODE ) {
			console.log( 'フルスクリーンボタンがクリックされました' );
		}

		if ( ! this.isFullscreen ) {
			this.enterFullscreen();
		} else {
			this.exitFullscreen();
		}
	}

	/**
	 * フルスクリーンに入る
	 */
	enterFullscreen() {
		if ( this.viewer.isMobile ) return;

		if ( DEBUG_MODE ) {
			console.log( 'フルスクリーン開始' );
		}

		// 画面回転を横向きに固定
		if ( screen.orientation && screen.orientation.lock ) {
			screen.orientation.lock( 'landscape' ).catch( ( err ) => {
				if ( DEBUG_MODE ) {
					console.log( '画面回転ロックに失敗:', err );
				}
			} );
		}

		// 元の状態を保存
		this.originalParent = this.viewer.container.parentNode;
		this.originalNextSibling = this.viewer.container.nextSibling;
		this.originalPosition = this.viewer.container.style.position;
		this.originalTop = this.viewer.container.style.top;
		this.originalLeft = this.viewer.container.style.left;
		this.originalWidth = this.viewer.container.style.width;
		this.originalHeight = this.viewer.container.style.height;
		this.originalPaddingTop = this.viewer.container.style.paddingTop;
		this.originalMaxWidth = this.viewer.container.style.maxWidth;
		this.originalMaxHeight = this.viewer.container.style.maxHeight;
		this.originalZIndex = this.viewer.container.style.zIndex;
		this.originalBackground = this.viewer.container.style.backgroundColor;

		// フルスクリーンオーバーレイを作成
		this.fullscreenOverlay = document.createElement( 'div' );
		this.fullscreenOverlay.className = 'psv-fullscreen-overlay';
		this.fullscreenOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

		// ビューアーをフルスクリーンスタイルに
		this.viewer.container.style.position = 'relative';
		this.viewer.container.style.width = '100vw';
		this.viewer.container.style.height = '100vh';
		this.viewer.container.style.paddingTop = '0';
		this.viewer.container.style.maxWidth = 'none';
		this.viewer.container.style.maxHeight = 'none';
		this.viewer.container.style.backgroundColor = '#000';

		// オーバーレイにビューアーを移動
		this.fullscreenOverlay.appendChild( this.viewer.container );
		document.body.appendChild( this.fullscreenOverlay );

		// 真のフルスクリーンを試行
		this.tryTrueFullscreen();

		this.isFullscreen = true;
		this.onFullscreenChange();

		// スクロール防止
		document.body.style.overflow = 'hidden';
		document.addEventListener( 'touchmove', this.boundPreventScroll, {
			passive: false,
		} );
	}

	/**
	 * ブラウザのフルスクリーンAPIを試行する
	 */
	tryTrueFullscreen() {
		const docElement = document.documentElement;

		if ( this.viewer.isMac ) {
			if ( docElement.webkitRequestFullscreen ) {
				docElement.webkitRequestFullscreen().catch( ( err ) => {
					if ( DEBUG_MODE ) {
						console.log( 'Mac webkitRequestFullscreen 失敗:', err );
					}
					this.tryAlternativeFullscreen();
				} );
			} else if ( docElement.requestFullscreen ) {
				docElement.requestFullscreen().catch( ( err ) => {
					if ( DEBUG_MODE ) {
						console.log( 'Mac requestFullscreen 失敗:', err );
					}
					this.tryAlternativeFullscreen();
				} );
			} else {
				if ( DEBUG_MODE ) {
					console.log( 'MacでフルスクリーンAPIが対応していません' );
				}
				this.tryAlternativeFullscreen();
			}
		} else {
			if ( docElement.requestFullscreen ) {
				docElement.requestFullscreen().catch( ( err ) => {
					if ( DEBUG_MODE ) {
						console.log(
							'documentElement.requestFullscreen 失敗:',
							err
						);
					}
					this.tryAlternativeFullscreen();
				} );
			} else if ( docElement.webkitRequestFullscreen ) {
				docElement.webkitRequestFullscreen();
			} else if ( docElement.mozRequestFullScreen ) {
				docElement.mozRequestFullScreen();
			} else if ( docElement.msRequestFullscreen ) {
				docElement.msRequestFullscreen();
			} else {
				if ( DEBUG_MODE ) {
					console.log( 'フルスクリーンAPIが対応していません' );
				}
				this.tryAlternativeFullscreen();
			}
		}
	}

	/**
	 * 代替フルスクリーンモードを試行する
	 */
	tryAlternativeFullscreen() {
		if ( DEBUG_MODE ) {
			console.log( '代替フルスクリーンモード' );
		}

		const viewport = document.querySelector( 'meta[name="viewport"]' );
		if ( viewport ) {
			this.originalViewport = viewport.getAttribute( 'content' );
			viewport.setAttribute(
				'content',
				'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
			);
		}

		if ( /iPhone|iPad|iPod/.test( navigator.userAgent ) ) {
			setTimeout( () => {
				window.scrollTo( 0, 1 );
			}, 100 );
		}
	}

	/**
	 * フルスクリーンを終了する
	 */
	exitFullscreen() {
		if ( DEBUG_MODE ) {
			console.log( 'フルスクリーン終了' );
		}

		// 画面回転ロックを解除
		if ( screen.orientation && screen.orientation.unlock ) {
			screen.orientation.unlock();
		}

		// ビューポートを元に戻す
		if ( this.originalViewport ) {
			const viewport = document.querySelector( 'meta[name="viewport"]' );
			if ( viewport ) {
				viewport.setAttribute( 'content', this.originalViewport );
			}
		}

		// スクロール防止を解除
		document.body.style.overflow = '';
		document.removeEventListener( 'touchmove', this.boundPreventScroll );

		// ビューアーを元の位置に戻す
		if ( this.originalParent ) {
			this.viewer.container.style.position = this.originalPosition;
			this.viewer.container.style.top = this.originalTop;
			this.viewer.container.style.left = this.originalLeft;
			this.viewer.container.style.width = this.originalWidth;
			this.viewer.container.style.height = this.originalHeight;
			this.viewer.container.style.paddingTop = this.originalPaddingTop;
			this.viewer.container.style.maxWidth = this.originalMaxWidth;
			this.viewer.container.style.maxHeight = this.originalMaxHeight;
			this.viewer.container.style.zIndex = this.originalZIndex;
			this.viewer.container.style.backgroundColor =
				this.originalBackground;

			if ( this.originalNextSibling ) {
				this.originalParent.insertBefore(
					this.viewer.container,
					this.originalNextSibling
				);
			} else {
				this.originalParent.appendChild( this.viewer.container );
			}
		}

		// オーバーレイを削除
		if ( this.fullscreenOverlay ) {
			this.fullscreenOverlay.remove();
			this.fullscreenOverlay = null;
		}

		// ブラウザのフルスクリーンを終了
		if ( this.viewer.isMac ) {
			if ( document.webkitExitFullscreen ) {
				document.webkitExitFullscreen();
			} else if ( document.exitFullscreen ) {
				document.exitFullscreen().catch( ( err ) => {
					if ( DEBUG_MODE ) {
						console.log( 'Mac フルスクリーン終了失敗:', err );
					}
				} );
			}
		} else {
			if ( document.exitFullscreen ) {
				document.exitFullscreen().catch( ( err ) => {
					if ( DEBUG_MODE ) {
						console.log( 'フルスクリーン終了失敗:', err );
					}
				} );
			} else if ( document.webkitExitFullscreen ) {
				document.webkitExitFullscreen();
			} else if ( document.mozCancelFullScreen ) {
				document.mozCancelFullScreen();
			} else if ( document.msExitFullscreen ) {
				document.msExitFullscreen();
			}
		}

		this.isFullscreen = false;
		this.onFullscreenChange();

		setTimeout( () => {
			if ( this.viewer.eventHandlers ) {
				this.viewer.eventHandlers.onWindowResize();
			}
		}, 100 );
	}

	/**
	 * フルスクリーン状態変更時の処理
	 */
	onFullscreenChange() {
		if ( this.viewer.eventHandlers ) {
			this.viewer.eventHandlers.onWindowResize();
		}

		if ( ! this.viewer.isMobile && this.viewer.fullscreenButton ) {
			if ( this.isFullscreen ) {
				this.viewer.fullscreenButton.innerHTML = '✕';
				this.viewer.fullscreenButton.title = 'フルスクリーン終了';
			} else {
				this.viewer.fullscreenButton.innerHTML = '⛶';
				this.viewer.fullscreenButton.title = 'フルスクリーン';
			}
		}
	}

	/**
	 * フルスクリーン状態変更イベントハンドラー
	 */
	handleFullscreenChange() {
		if ( this.viewer.isMobile ) return;

		const isCurrentlyFullscreen = !! (
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement
		);

		this.isFullscreen = isCurrentlyFullscreen;
		this.onFullscreenChange();
	}

	/**
	 * ESCキーイベントハンドラー
	 */
	handleEscapeKey( e ) {
		if ( this.viewer.isMobile ) return;

		if ( e.key === 'Escape' && this.isFullscreen ) {
			this.exitFullscreen();
		}
	}

	/**
	 * スクロール防止
	 */
	preventScroll( e ) {
		e.preventDefault();
		return false;
	}
}
