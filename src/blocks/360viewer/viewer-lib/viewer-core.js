import {
	getGlobalWebGLConfig,
	getSphereGeometryConfig,
	configureTextureFilters,
} from './webgl-config.js';
import {
	createCanvas2DRenderer,
	showErrorMessage,
} from './canvas2d-renderer.js';
import { DEBUG_MODE } from './debug-config.js';

// WebGLコンテキストの管理用
const MAX_ACTIVE_VIEWERS = 3;
const activeViewers = new Set();

/**
 * ビューアーのコア機能を提供するクラス
 */
export class ViewerCore {
	constructor( viewer ) {
		this.viewer = viewer;
		this.boundHandleContextLost = this.handleContextLost.bind( this );
		this.boundHandleContextRestored =
			this.handleContextRestored.bind( this );
		this.boundAnimate = this.animate.bind( this );
	}

	/**
	 * Intersection Observerをセットアップする
	 */
	setupIntersectionObserver() {
		if ( ! ( 'IntersectionObserver' in window ) ) {
			if ( DEBUG_MODE ) {
				console.log(
					'IntersectionObserver not supported, skipping visibility optimization'
				);
			}
			// IntersectionObserver 非対応の場合はすぐにレンダラーを初期化
			this.initializeRenderer();
			this.activate();
			return;
		}

		this.viewer.intersectionObserver = new IntersectionObserver(
			( entries ) => {
				entries.forEach( ( entry ) => {
					this.viewer.isVisible = entry.isIntersecting;
					if ( this.viewer.isVisible ) {
						if ( DEBUG_MODE ) {
							console.log(
								'Viewer became visible, resuming animation'
							);
						}
						// 初回表示時にレンダラーを遅延初期化
						this.initializeRenderer();
						this.activate();
					} else {
						if ( DEBUG_MODE ) {
							console.log(
								'Viewer became hidden, pausing animation'
							);
						}
						this.stopAnimation();
					}
				} );
			},
			{
				threshold: 0.1,
			}
		);

		this.viewer.intersectionObserver.observe( this.viewer.container );
	}

	/**
	 * シーン、カメラ、レンダラーを初期化する
	 */
	initializeThreeJS() {
		this.initializeScene();
		this.initializeRenderer();
	}

	/**
	 * シーンとカメラのみを初期化する（レンダラーは遅延）
	 */
	initializeScene() {
		try {
			this.viewer.scene = new THREE.Scene();
			this.viewer.camera = new THREE.PerspectiveCamera(
				75,
				this.viewer.container.clientWidth /
					this.viewer.container.clientHeight || 1,
				1,
				1100
			);
			this.viewer.camera.target = new THREE.Vector3( 0, 0, 0 );
		} catch ( error ) {
			console.error( 'ビューアーの初期化に失敗しました:', error );
			showErrorMessage(
				this.viewer.container,
				'360°ビューアーの初期化に失敗しました。'
			);
		}
	}

	/**
	 * レンダラーを初期化してDOMに追加する（初回表示時に呼ぶ）
	 */
	initializeRenderer() {
		if ( this.viewer.renderer ) return;

		try {
			this.viewer.renderer = this.createRenderer();

			// カメラのアスペクト比を実際のサイズで更新
			const w = this.viewer.container.clientWidth;
			const h = this.viewer.container.clientHeight;
			if ( w && h ) {
				this.viewer.camera.aspect = w / h;
				this.viewer.camera.updateProjectionMatrix();
			}

			this.viewer.container.appendChild(
				this.viewer.renderer.domElement
			);

			if ( this.viewer.renderer.isCanvas2D ) {
				showErrorMessage( this.viewer.container, '' );
			}

			if ( ! this.viewer.renderer.isCanvas2D ) {
				this.viewer.renderer.domElement.addEventListener(
					'webglcontextlost',
					this.boundHandleContextLost,
					false
				);
				this.viewer.renderer.domElement.addEventListener(
					'webglcontextrestored',
					this.boundHandleContextRestored,
					false
				);

				// テクスチャがレンダラーより先に読み込まれた場合にアニソトロピーを再適用
				const texture =
					this.viewer.sphere?.material?.map;
				if ( texture ) {
					configureTextureFilters( texture, this.viewer.renderer );
					texture.needsUpdate = true;
				}
			}
		} catch ( error ) {
			console.error( 'レンダラーの初期化に失敗しました:', error );
			showErrorMessage(
				this.viewer.container,
				'360°ビューアーの初期化に失敗しました。'
			);
		}
	}

	/**
	 * 球体ジオメトリとテクスチャを作成する
	 */
	createSphere() {
		const geometryConfig = getSphereGeometryConfig();
		const geometry = new THREE.SphereGeometry(
			500,
			geometryConfig.segments,
			geometryConfig.rings
		);
		geometry.scale( -1, 1, 1 );

		const textureUrl = this.normalizeTextureUrl( this.viewer.imageUrl );
		this.viewer.imageUrl = textureUrl;

		const textureLoader = new THREE.TextureLoader();
		const useColorSpace = THREE.SRGBColorSpace !== undefined;

		if ( this.isCrossOriginTexture( textureUrl ) ) {
			textureLoader.setCrossOrigin( 'anonymous' );
		}

		if ( ! useColorSpace ) {
			textureLoader.encoding = THREE.sRGBEncoding;
		}

		const texture = textureLoader.load(
			textureUrl,
			() => {
				if ( useColorSpace ) {
					texture.colorSpace = THREE.SRGBColorSpace;
				} else {
					texture.encoding = THREE.sRGBEncoding;
				}

				texture.wrapS = THREE.RepeatWrapping;
				texture.repeat.x = 1.0;

				configureTextureFilters( texture, this.viewer.renderer );

				const material = new THREE.MeshBasicMaterial( {
					map: texture,
					side: THREE.DoubleSide,
				} );

				this.viewer.sphere = new THREE.Mesh( geometry, material );
				this.viewer.scene.add( this.viewer.sphere );
			},
			undefined,
			( error ) => {
				const hint = this.getTextureLoadHint( textureUrl );
				console.error( 'テクスチャの読み込みに失敗しました:', {
					imageUrl: textureUrl,
					hint,
					error,
				} );
				showErrorMessage(
					this.viewer.container,
					`360°画像の読み込みに失敗しました。${ hint }`
				);
			}
		);
	}

	/**
	 * data-img から取得したURLを正規化する
	 * @param {string} rawUrl
	 * @returns {string}
	 */
	normalizeTextureUrl( rawUrl ) {
		const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
		if ( ! value ) {
			return '';
		}

		const textarea = document.createElement( 'textarea' );
		textarea.innerHTML = value;
		const decoded = textarea.value;

		try {
			const parsedUrl = new URL( decoded, window.location.href );

			if (
				window.location.protocol === 'https:' &&
				parsedUrl.protocol === 'http:' &&
				parsedUrl.hostname === window.location.hostname
			) {
				parsedUrl.protocol = 'https:';
			}

			return parsedUrl.toString();
		} catch ( error ) {
			return decoded;
		}
	}

	/**
	 * 外部オリジンの画像かどうかを判定する
	 * @param {string} imageUrl
	 * @returns {boolean}
	 */
	isCrossOriginTexture( imageUrl ) {
		try {
			const parsedUrl = new URL( imageUrl, window.location.href );
			return parsedUrl.origin !== window.location.origin;
		} catch ( error ) {
			return false;
		}
	}

	/**
	 * テクスチャ読み込み失敗時のヒント文言を生成する
	 * @param {string} imageUrl
	 * @returns {string}
	 */
	getTextureLoadHint( imageUrl ) {
		try {
			const parsedUrl = new URL( imageUrl, window.location.href );
			if (
				window.location.protocol === 'https:' &&
				parsedUrl.protocol === 'http:'
			) {
				return 'HTTPSページでHTTP画像が指定されています（混在コンテンツ）。画像URLをHTTPSに変更してください。';
			}

			if ( parsedUrl.origin !== window.location.origin ) {
				return '外部ドメイン画像です。配信元でCORS許可ヘッダー（Access-Control-Allow-Origin）を確認してください。';
			}
		} catch ( error ) {
			return '画像URLの形式が不正です。URLを再設定してください。';
		}

		return '画像URLが無効、または画像ファイルが 403/404 で取得できません。URLと権限を確認してください。';
	}

	/**
	 * レンダラーを作成する
	 */
	createRenderer() {
		if ( ! this.viewer.webglSupported ) {
			if ( DEBUG_MODE ) {
				console.warn(
					'WebGLがサポートされていません。Canvas2Dフォールバックを使用します。'
				);
			}
			return createCanvas2DRenderer( this.viewer.container, this.viewer );
		}

		try {
			const webglConfig = getGlobalWebGLConfig();

			if ( DEBUG_MODE ) {
				console.log(
					'Creating WebGL renderer with config:',
					webglConfig.rendererOptions
				);
			}

			let renderer;

			if ( this.viewer.isMobile ) {
				renderer = this.tryMobileWebGLConfigs( webglConfig );
			} else {
				renderer = new THREE.WebGLRenderer(
					webglConfig.rendererOptions
				);

				if (
					! renderer ||
					! renderer.domElement ||
					! renderer.getContext()
				) {
					throw new Error( 'WebGL renderer creation failed' );
				}
			}

			renderer.setPixelRatio( webglConfig.pixelRatio );
			if ( DEBUG_MODE ) {
				console.log(
					'WebGL renderer created successfully - pixel ratio:',
					webglConfig.pixelRatio
				);
			}

			renderer.setSize(
				this.viewer.container.clientWidth,
				this.viewer.container.clientHeight
			);

			if ( THREE.SRGBColorSpace !== undefined ) {
				renderer.outputColorSpace = THREE.SRGBColorSpace;
			} else {
				renderer.outputEncoding = THREE.sRGBEncoding;
				renderer.gammaFactor = 2.2;
				renderer.gammaOutput = true;
			}

			return renderer;
		} catch ( error ) {
			console.error( 'WebGLレンダラーの作成に失敗しました:', error );
			if ( DEBUG_MODE ) {
				console.warn(
					'WebGL initialization failed, switching to Canvas2D fallback'
				);
				console.warn( 'Error details:', error.message );
			}
			return createCanvas2DRenderer( this.viewer.container, this.viewer );
		}
	}

	/**
	 * モバイル用のWebGL設定を試行する
	 */
	tryMobileWebGLConfigs( webglConfig ) {
		const configs = [
			webglConfig.rendererOptions,
			{
				antialias: false,
				preserveDrawingBuffer: false,
				powerPreference: 'low-power',
				failIfMajorPerformanceCaveat: false,
			},
			{
				antialias: false,
				failIfMajorPerformanceCaveat: false,
			},
			{ failIfMajorPerformanceCaveat: false },
			{},
		];

		for ( let i = 0; i < configs.length; i++ ) {
			try {
				if ( DEBUG_MODE ) {
					console.log(
						`Trying WebGL config ${ i + 1 }:`,
						configs[ i ]
					);
				}
				const renderer = new THREE.WebGLRenderer( configs[ i ] );

				if (
					renderer &&
					renderer.domElement &&
					renderer.getContext()
				) {
					if ( DEBUG_MODE ) {
						console.log(
							`WebGL renderer created successfully with config ${
								i + 1
							}`
						);
					}
					return renderer;
				} else {
					throw new Error(
						`WebGL renderer creation failed with config ${ i + 1 }`
					);
				}
			} catch ( configError ) {
				if ( DEBUG_MODE ) {
					console.warn(
						`WebGL config ${ i + 1 } failed:`,
						configError.message
					);
				}
				if ( i === configs.length - 1 ) {
					throw configError;
				}
			}
		}
	}

	/**
	 * WebGLコンテキスト損失時の処理
	 */
	handleContextLost( event ) {
		event.preventDefault();
		if ( DEBUG_MODE ) {
			console.warn( 'WebGLコンテキストが失われました' );
		}
		this.stopAnimation();

		if ( this.viewer.isMobile && this.viewer.webglSupported ) {
			if ( DEBUG_MODE ) {
				console.log( 'Mobile device - attempting Canvas2D fallback' );
			}
			showErrorMessage(
				this.viewer.container,
				'WebGLが利用できません。Canvas2Dモードに切り替えます...'
			);
			setTimeout( () => {
				this.switchToCanvas2D();
			}, 1000 );
		}
	}

	/**
	 * WebGLコンテキスト復元時の処理
	 */
	handleContextRestored() {
		if ( DEBUG_MODE ) {
			console.log( 'WebGLコンテキストが復元されました' );
		}
		this.startAnimation();
	}

	/**
	 * Canvas2Dフォールバックに切り替える
	 */
	switchToCanvas2D() {
		if ( DEBUG_MODE ) {
			console.log( 'Switching to Canvas2D fallback' );
		}

		if ( this.viewer.renderer && this.viewer.renderer.domElement ) {
			if ( ! this.viewer.renderer.isCanvas2D ) {
				this.viewer.renderer.domElement.removeEventListener(
					'webglcontextlost',
					this.boundHandleContextLost
				);
				this.viewer.renderer.domElement.removeEventListener(
					'webglcontextrestored',
					this.boundHandleContextRestored
				);
			}
			this.viewer.renderer.dispose();

			if (
				this.viewer.container.contains(
					this.viewer.renderer.domElement
				)
			) {
				this.viewer.container.removeChild(
					this.viewer.renderer.domElement
				);
			}
		}

		this.viewer.renderer = createCanvas2DRenderer(
			this.viewer.container,
			this.viewer
		);

		if ( this.viewer.container.firstChild ) {
			this.viewer.container.insertBefore(
				this.viewer.renderer.domElement,
				this.viewer.container.firstChild
			);
		} else {
			this.viewer.container.appendChild(
				this.viewer.renderer.domElement
			);
		}

		this.startAnimation();

		if ( DEBUG_MODE ) {
			console.log( 'Canvas2D fallback activated' );
		}
	}

	/**
	 * ビューアーをアクティブ化する
	 */
	activate() {
		if ( this.viewer.isDisposed ) return;

		if ( activeViewers.size >= MAX_ACTIVE_VIEWERS ) {
			const oldestViewer = Array.from( activeViewers )[ 0 ];
			oldestViewer.core.deactivate();
		}

		activeViewers.add( this.viewer );
		this.startAnimation();
	}

	/**
	 * ビューアーを非アクティブ化する
	 */
	deactivate() {
		if ( this.viewer.isDisposed ) return;

		activeViewers.delete( this.viewer );
		this.stopAnimation();
	}

	/**
	 * アニメーションを開始する
	 */
	startAnimation() {
		if ( ! this.viewer.isAnimating ) {
			this.viewer.isAnimating = true;
			this.animate();
		}
	}

	/**
	 * アニメーションを停止する
	 */
	stopAnimation() {
		this.viewer.isAnimating = false;
	}

	/**
	 * アニメーションループ
	 */
	animate() {
		if ( ! this.viewer.isAnimating || this.viewer.isDisposed ) return;

		requestAnimationFrame( this.boundAnimate );
		this.update();
	}

	/**
	 * フレームごとの更新処理
	 */
	update() {
		if (
			! this.viewer.camera ||
			! this.viewer.renderer ||
			this.viewer.isDisposed ||
			! this.viewer.isVisible
		)
			return;

		// 時間ベースの自動回転
		if ( this.viewer.autoRotate && ! this.viewer.isUserInteracting ) {
			const currentTime = performance.now();
			if ( this.viewer.lastTime > 0 ) {
				const deltaTime = ( currentTime - this.viewer.lastTime ) / 1000;
				this.viewer.lon += this.viewer.autoRotateSpeed * deltaTime;
			}
			this.viewer.lastTime = currentTime;
		} else {
			this.viewer.lastTime = performance.now();
		}

		this.viewer.lat = Math.max( -85, Math.min( 85, this.viewer.lat ) );
		this.viewer.phi = THREE.MathUtils.degToRad( 90 - this.viewer.lat );
		this.viewer.theta = THREE.MathUtils.degToRad( this.viewer.lon );

		if ( this.viewer.renderer.isCanvas2D ) {
			this.viewer.renderer.render(
				this.viewer.scene,
				this.viewer.camera
			);
		} else {
			this.viewer.camera.position.x =
				100 *
				Math.sin( this.viewer.phi ) *
				Math.cos( this.viewer.theta );
			this.viewer.camera.position.y = 100 * Math.cos( this.viewer.phi );
			this.viewer.camera.position.z =
				100 *
				Math.sin( this.viewer.phi ) *
				Math.sin( this.viewer.theta );

			this.viewer.camera.lookAt( this.viewer.camera.target );
			this.viewer.renderer.render(
				this.viewer.scene,
				this.viewer.camera
			);
		}
	}

	/**
	 * リソースを解放する
	 */
	dispose() {
		if ( this.viewer.isDisposed ) return;

		this.viewer.isDisposed = true;
		this.deactivate();

		if ( this.viewer.intersectionObserver ) {
			this.viewer.intersectionObserver.disconnect();
			this.viewer.intersectionObserver = null;
		}

		if ( this.viewer.autoRotateTimeout ) {
			clearTimeout( this.viewer.autoRotateTimeout );
			this.viewer.autoRotateTimeout = null;
		}

		if ( this.viewer.sphere ) {
			this.viewer.sphere.geometry.dispose();
			this.viewer.sphere.material.map?.dispose();
			this.viewer.sphere.material.dispose();
			this.viewer.scene.remove( this.viewer.sphere );
		}

		if ( this.viewer.scene ) {
			this.viewer.scene.clear();
		}

		if ( this.viewer.renderer ) {
			if ( ! this.viewer.renderer.isCanvas2D ) {
				this.viewer.renderer.domElement.removeEventListener(
					'webglcontextlost',
					this.boundHandleContextLost
				);
				this.viewer.renderer.domElement.removeEventListener(
					'webglcontextrestored',
					this.boundHandleContextRestored
				);
			}

			this.viewer.renderer.dispose();

			if (
				this.viewer.container.contains(
					this.viewer.renderer.domElement
				)
			) {
				this.viewer.container.removeChild(
					this.viewer.renderer.domElement
				);
			}
		}

		this.viewer.scene = null;
		this.viewer.camera = null;
		this.viewer.renderer = null;
		this.viewer.sphere = null;
	}
}
