import { DEBUG_MODE } from './debug-config.js';

/**
 * Canvas2Dフォールバックレンダラーを作成する関数
 * @param {HTMLElement} container - コンテナ要素
 * @param {Object} context - ビューアーのコンテキスト
 * @returns {Object} レンダラーオブジェクト
 */
export function createCanvas2DRenderer( container, context ) {
	const canvas = document.createElement( 'canvas' );
	const ctx = canvas.getContext( '2d' );
	const textureCanvas = document.createElement( 'canvas' );
	const textureCtx = textureCanvas.getContext( '2d', {
		willReadFrequently: true,
	} );
	const upscaleCanvas = document.createElement( 'canvas' );
	const upscaleCtx = upscaleCanvas.getContext( '2d' );

	const renderCache = {
		sourceImage: null,
		sourcePixels: null,
		sourceWidth: 0,
		sourceHeight: 0,
		renderImageData: null,
		renderWidth: 0,
		renderHeight: 0,
		lastRenderTime: 0,
	};

	const performanceLevel = context?.deviceInfo?.performanceLevel || 'medium';
	// インタラクション中も含めた最低フレーム間隔（ms）
	// low: ~15fps、medium/high: ~30fps、インタラクション中は 60fps 上限
	const minRenderInterval = performanceLevel === 'low' ? 66 : 33;
	const minInteractInterval = 16; // ~60fps 上限

	canvas.width = container.clientWidth;
	canvas.height = container.clientHeight;

	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.zIndex = '0';

	const renderer = {
		domElement: canvas,
		context: ctx,
		isCanvas2D: true,

		setSize: function ( width, height ) {
			canvas.width = width;
			canvas.height = height;
		},

		setPixelRatio: function () {
			// Canvas2Dではピクセル比の設定は無視
		},

		render: function ( _scene, camera ) {
			const now = performance.now();
			const interval = context.isUserInteracting
				? minInteractInterval
				: minRenderInterval;
			if ( now - renderCache.lastRenderTime < interval ) {
				return;
			}
			renderCache.lastRenderTime = now;

			renderCanvas2D( ctx, canvas, camera, context, renderCache, {
				textureCanvas,
				textureCtx,
				upscaleCanvas,
				upscaleCtx,
			} );
		},

		dispose: function () {
			renderCache.sourceImage = null;
			renderCache.sourcePixels = null;
			renderCache.renderImageData = null;
			canvas.remove();
		},
	};

	return renderer;
}

/**
 * Canvas2Dでパノラマを描画する関数
 * @param {CanvasRenderingContext2D} ctx - 2Dコンテキスト
 * @param {HTMLCanvasElement} canvas - Canvasエレメント
 * @param {Object} camera - Three.jsカメラ
 * @param {Object} context - ビューアーのコンテキスト（lon, lat, sphere を含む）
 * @param {Object} renderCache - レンダリングキャッシュ
 * @param {Object} helperCanvases - 補助キャンバス群
 */
function renderCanvas2D(
	ctx,
	canvas,
	camera,
	context,
	renderCache,
	helperCanvases
) {
	if ( ! context.sphere ) return;

	ctx.clearRect( 0, 0, canvas.width, canvas.height );

	if (
		context.sphere &&
		context.sphere.material &&
		context.sphere.material.map
	) {
		const texture = context.sphere.material.map;
		const image = texture.image;

		if ( image && image.complete ) {
			updateTextureCache(
				image,
				renderCache,
				helperCanvases.textureCanvas,
				helperCanvases.textureCtx
			);
			drawPanoramaOnCanvas(
				ctx,
				image,
				canvas.width,
				canvas.height,
				camera,
				context,
				renderCache,
				helperCanvases.upscaleCanvas,
				helperCanvases.upscaleCtx
			);
		}
	}
}

function updateTextureCache( image, renderCache, textureCanvas, textureCtx ) {
	if ( renderCache.sourceImage === image && renderCache.sourcePixels ) {
		return;
	}

	textureCanvas.width = image.width;
	textureCanvas.height = image.height;
	textureCtx.drawImage( image, 0, 0 );

	try {
		const sourceImageData = textureCtx.getImageData(
			0,
			0,
			image.width,
			image.height
		);
		renderCache.sourceImage = image;
		renderCache.sourcePixels = sourceImageData.data;
		renderCache.sourceWidth = image.width;
		renderCache.sourceHeight = image.height;
	} catch ( error ) {
		renderCache.sourceImage = image;
		renderCache.sourcePixels = null;
		renderCache.sourceWidth = image.width;
		renderCache.sourceHeight = image.height;

		if ( DEBUG_MODE ) {
			console.warn( 'Canvas2D texture cache creation failed:', error );
		}
	}
}

/**
 * デバイス性能に応じたレンダリング設定を決定
 * @param {Object} context - ビューアーのコンテキスト
 * @param {number} width - Canvas幅
 * @param {number} height - Canvas高さ
 * @returns {Object} { samples, width, height, scaleRatio }
 */
function determineRenderSettings( context, width, height ) {
	// デバイス情報を取得（ビューアーインスタンスから）
	let performanceLevel = 'medium'; // デフォルト

	// コンテキストはPanoramaViewerインスタンス
	if ( context && context.deviceInfo ) {
		performanceLevel = context.deviceInfo.performanceLevel;
	} else {
		// フォールバック: 簡易判定
		const isMobile =
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent
			);
		performanceLevel = isMobile ? 'low' : 'medium';
	}

	const resolution = width * height;

	// 性能レベル別の設定
	let samples = 1;
	let scaleRatio = 1.0;

	switch ( performanceLevel ) {
		case 'high':
			// 高性能: スーパーサンプリング有効（ただし解像度が大きすぎない場合）
			if ( resolution < 1920 * 1080 ) {
				samples = 2; // 2x2スーパーサンプリング
			}
			scaleRatio = 1.0; // フル解像度
			break;

		case 'medium':
			// 中性能: バイリニア補間のみ
			samples = 1;
			scaleRatio = 1.0; // フル解像度
			break;

		case 'low':
			// 低性能: バイリニア補間 + 解像度削減
			samples = 1;
			// 解像度を75%に削減（ピクセル数は約56%に）
			scaleRatio = 0.75;
			break;

		default:
			samples = 1;
			scaleRatio = 1.0;
	}

	// 実際のレンダリング解像度を計算
	const renderWidth = Math.round( width * scaleRatio );
	const renderHeight = Math.round( height * scaleRatio );

	if ( DEBUG_MODE ) {
		console.log(
			`Canvas2D render settings: performance=${ performanceLevel }, samples=${ samples }x${ samples }, resolution=${ renderWidth }x${ renderHeight } (${ Math.round(
				scaleRatio * 100
			) }%)`
		);
	}

	return {
		samples,
		width: renderWidth,
		height: renderHeight,
		scaleRatio,
	};
}

/**
 * Canvas2Dでパノラマを描画する詳細な処理（高画質版）
 * @param {CanvasRenderingContext2D} ctx - 2Dコンテキスト
 * @param {HTMLImageElement} image - パノラマ画像
 * @param {number} width - Canvas幅
 * @param {number} height - Canvas高さ
 * @param {Object} camera - Three.jsカメラ
 * @param {Object} context - ビューアーのコンテキスト（lon, lat を含む）
 * @param {Object} renderCache - レンダリングキャッシュ
 * @param {HTMLCanvasElement} upscaleCanvas - 拡大描画用キャンバス
 * @param {CanvasRenderingContext2D} upscaleCtx - 拡大描画用コンテキスト
 */
function drawPanoramaOnCanvas(
	ctx,
	image,
	width,
	height,
	camera,
	context,
	renderCache,
	upscaleCanvas,
	upscaleCtx
) {
	ctx.clearRect( 0, 0, width, height );

	const sourcePixels = renderCache.sourcePixels;
	const sourceWidth = renderCache.sourceWidth || image.width;
	const sourceHeight = renderCache.sourceHeight || image.height;
	if ( ! sourcePixels ) {
		ctx.drawImage( image, 0, 0, width, height );
		return;
	}

	// カメラの設定
	const fov = camera.fov;
	const aspect = width / height;

	// 球面座標からスクリーン座標への変換
	const phi = THREE.MathUtils.degToRad( 90 - context.lat );
	const theta = THREE.MathUtils.degToRad( context.lon );

	// カメラの位置
	const cameraX = 100 * Math.sin( phi ) * Math.cos( theta );
	const cameraY = 100 * Math.cos( phi );
	const cameraZ = 100 * Math.sin( phi ) * Math.sin( theta );

	// カメラの向き
	const cameraDirX = -cameraX;
	const cameraDirY = -cameraY;
	const cameraDirZ = -cameraZ;
	const cameraDirLength = Math.sqrt(
		cameraDirX * cameraDirX +
			cameraDirY * cameraDirY +
			cameraDirZ * cameraDirZ
	);
	const cameraDirNormX = cameraDirX / cameraDirLength;
	const cameraDirNormY = cameraDirY / cameraDirLength;
	const cameraDirNormZ = cameraDirZ / cameraDirLength;

	// カメラの上方向
	const cameraUpX = 0;
	const cameraUpY = 1;
	const cameraUpZ = 0;

	// カメラの右方向（外積）
	const cameraRightX =
		cameraDirNormY * cameraUpZ - cameraDirNormZ * cameraUpY;
	const cameraRightY =
		cameraDirNormZ * cameraUpX - cameraDirNormX * cameraUpZ;
	const cameraRightZ =
		cameraDirNormX * cameraUpY - cameraDirNormY * cameraUpX;
	const cameraRightLength = Math.sqrt(
		cameraRightX * cameraRightX +
			cameraRightY * cameraRightY +
			cameraRightZ * cameraRightZ
	);
	const cameraRightNormX = cameraRightX / cameraRightLength;
	const cameraRightNormY = cameraRightY / cameraRightLength;
	const cameraRightNormZ = cameraRightZ / cameraRightLength;

	// カメラの実際の上方向（外積）
	const cameraActualUpX =
		cameraRightNormY * cameraDirNormZ - cameraRightNormZ * cameraDirNormY;
	const cameraActualUpY =
		cameraRightNormZ * cameraDirNormX - cameraRightNormX * cameraDirNormZ;
	const cameraActualUpZ =
		cameraRightNormX * cameraDirNormY - cameraRightNormY * cameraDirNormX;

	// FOVに基づくスケール
	const fovRad = THREE.MathUtils.degToRad( fov );
	const scale = Math.tan( fovRad / 2 );

	// デバイス性能に応じた最適化設定を決定
	const renderSettings = determineRenderSettings( context, width, height );
	const samples = renderSettings.samples;
	const renderWidth = renderSettings.width;
	const renderHeight = renderSettings.height;
	const scaleRatio = renderSettings.scaleRatio;

	// レンダリング解像度でImageDataを作成（低性能デバイスでは縮小）
	const shouldCreateRenderImage =
		! renderCache.renderImageData ||
		renderCache.renderWidth !== renderWidth ||
		renderCache.renderHeight !== renderHeight;

	if ( shouldCreateRenderImage ) {
		renderCache.renderImageData = ctx.createImageData(
			renderWidth,
			renderHeight
		);
		renderCache.renderWidth = renderWidth;
		renderCache.renderHeight = renderHeight;
	}

	const renderImageData = renderCache.renderImageData;
	const renderPixels = renderImageData.data;

	// スクリーンの各ピクセルに対して処理
	for ( let y = 0; y < renderHeight; y++ ) {
		for ( let x = 0; x < renderWidth; x++ ) {
			let totalR = 0,
				totalG = 0,
				totalB = 0,
				totalA = 0;
			let sampleCount = 0;

			// スーパーサンプリング
			for ( let sy = 0; sy < samples; sy++ ) {
				for ( let sx = 0; sx < samples; sx++ ) {
					// サブピクセルオフセット
					const offsetX = ( sx + 0.5 ) / samples - 0.5;
					const offsetY = ( sy + 0.5 ) / samples - 0.5;

					// スクリーン座標を-1から1の範囲に正規化
					const screenX =
						( ( 2 * ( x + offsetX ) ) / renderWidth - 1 ) *
						aspect *
						scale;
					const screenY =
						( 1 - ( 2 * ( y + offsetY ) ) / renderHeight ) * scale;

					// レイの方向
					const rayDirX =
						cameraDirNormX +
						screenX * cameraRightNormX +
						screenY * cameraActualUpX;
					const rayDirY =
						cameraDirNormY +
						screenX * cameraRightNormY +
						screenY * cameraActualUpY;
					const rayDirZ =
						cameraDirNormZ +
						screenX * cameraRightNormZ +
						screenY * cameraActualUpZ;

					// レイの方向を正規化
					const rayLength = Math.sqrt(
						rayDirX * rayDirX +
							rayDirY * rayDirY +
							rayDirZ * rayDirZ
					);
					const rayNormX = rayDirX / rayLength;
					const rayNormY = rayDirY / rayLength;
					const rayNormZ = rayDirZ / rayLength;

					// 球面座標に変換
					const spherePhi = Math.acos(
						Math.max( -1, Math.min( 1, rayNormY ) )
					);
					const sphereTheta = Math.atan2( rayNormZ, rayNormX );

					// テクスチャ座標に変換（0-1範囲）
					const u = ( sphereTheta + Math.PI ) / ( 2 * Math.PI );
					const v = spherePhi / Math.PI;

					// バイリニア補間でテクスチャサンプリング
					const color = sampleTextureBilinear(
						sourcePixels,
						sourceWidth,
						sourceHeight,
						u,
						v
					);

					totalR += color.r;
					totalG += color.g;
					totalB += color.b;
					totalA += color.a;
					sampleCount++;
				}
			}

			// 平均を取る
			const renderIndex = ( y * renderWidth + x ) * 4;
			renderPixels[ renderIndex ] = Math.round( totalR / sampleCount );
			renderPixels[ renderIndex + 1 ] = Math.round(
				totalG / sampleCount
			);
			renderPixels[ renderIndex + 2 ] = Math.round(
				totalB / sampleCount
			);
			renderPixels[ renderIndex + 3 ] = Math.round(
				totalA / sampleCount
			);
		}
	}

	// 低解像度でレンダリングした場合はスケールアップして描画
	if ( scaleRatio < 1.0 ) {
		// 一時キャンバスに描画
		if (
			upscaleCanvas.width !== renderWidth ||
			upscaleCanvas.height !== renderHeight
		) {
			upscaleCanvas.width = renderWidth;
			upscaleCanvas.height = renderHeight;
		}
		upscaleCtx.putImageData( renderImageData, 0, 0 );

		// スケールアップして元のサイズで描画（バイリニア補間が自動適用される）
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(
			upscaleCanvas,
			0,
			0,
			renderWidth,
			renderHeight,
			0,
			0,
			width,
			height
		);
	} else {
		// 通常サイズの場合は直接描画
		ctx.putImageData( renderImageData, 0, 0 );
	}

	if ( DEBUG_MODE ) {
		const qualityDesc =
			samples > 1
				? `${ samples }x${ samples } supersampling`
				: 'bilinear filtering';
		const resDesc =
			scaleRatio < 1.0
				? ` at ${ Math.round( scaleRatio * 100 ) }% resolution`
				: '';
		console.log(
			`Canvas2D mode: High-quality rendering with ${ qualityDesc }${ resDesc }`
		);
	}
}

/**
 * バイリニア補間でテクスチャをサンプリング
 * @param {Uint8ClampedArray} pixels - ピクセルデータ
 * @param {number} width - 画像幅
 * @param {number} height - 画像高さ
 * @param {number} u - テクスチャ座標U (0-1)
 * @param {number} v - テクスチャ座標V (0-1)
 * @returns {Object} { r, g, b, a }
 */
function sampleTextureBilinear( pixels, width, height, u, v ) {
	// UV座標をピクセル座標に変換
	const x = u * ( width - 1 );
	const y = v * ( height - 1 );

	// 4つの隣接ピクセルのインデックス
	const x0 = Math.floor( x );
	const y0 = Math.floor( y );
	const x1 = Math.min( x0 + 1, width - 1 );
	const y1 = Math.min( y0 + 1, height - 1 );

	// 補間係数
	const fx = x - x0;
	const fy = y - y0;

	// 4つのピクセルを取得
	const idx00 = ( y0 * width + x0 ) * 4;
	const idx10 = ( y0 * width + x1 ) * 4;
	const idx01 = ( y1 * width + x0 ) * 4;
	const idx11 = ( y1 * width + x1 ) * 4;

	// バイリニア補間
	const r =
		pixels[ idx00 ] * ( 1 - fx ) * ( 1 - fy ) +
		pixels[ idx10 ] * fx * ( 1 - fy ) +
		pixels[ idx01 ] * ( 1 - fx ) * fy +
		pixels[ idx11 ] * fx * fy;

	const g =
		pixels[ idx00 + 1 ] * ( 1 - fx ) * ( 1 - fy ) +
		pixels[ idx10 + 1 ] * fx * ( 1 - fy ) +
		pixels[ idx01 + 1 ] * ( 1 - fx ) * fy +
		pixels[ idx11 + 1 ] * fx * fy;

	const b =
		pixels[ idx00 + 2 ] * ( 1 - fx ) * ( 1 - fy ) +
		pixels[ idx10 + 2 ] * fx * ( 1 - fy ) +
		pixels[ idx01 + 2 ] * ( 1 - fx ) * fy +
		pixels[ idx11 + 2 ] * fx * fy;

	const a =
		pixels[ idx00 + 3 ] * ( 1 - fx ) * ( 1 - fy ) +
		pixels[ idx10 + 3 ] * fx * ( 1 - fy ) +
		pixels[ idx01 + 3 ] * ( 1 - fx ) * fy +
		pixels[ idx11 + 3 ] * fx * fy;

	return { r, g, b, a };
}

/**
 * エラーメッセージを表示する関数
 * @param {HTMLElement} container - コンテナ要素
 * @param {string} message - エラーメッセージ
 */
export function showErrorMessage( container, message ) {
	// 既存のエラーメッセージを削除
	const existingError = container.querySelector( '.psv-error-message' );
	if ( existingError ) {
		existingError.remove();
	}

	const errorDiv = document.createElement( 'div' );
	errorDiv.className = 'psv-error-message';
	errorDiv.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        width: 30px;
        height: 30px;
        background: rgba(255, 165, 0, 0.9);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        z-index: 1000;
        user-select: none;
        transition: transform 0.2s;
    `;
	errorDiv.textContent = 'i';
	errorDiv.title = 'Canvas2Dモードで動作中 - クリック/タップで詳細表示';

	errorDiv.addEventListener( 'mouseenter', () => {
		errorDiv.style.transform = 'scale(1.1)';
	} );

	errorDiv.addEventListener( 'mouseleave', () => {
		errorDiv.style.transform = 'scale(1)';
	} );

	errorDiv.addEventListener( 'click', ( e ) => {
		e.preventDefault();
		e.stopPropagation();
		showDetailedError( container, message );
	} );

	errorDiv.addEventListener( 'touchend', ( e ) => {
		e.preventDefault();
		e.stopPropagation();
		showDetailedError( container, message );
	} );

	container.appendChild( errorDiv );
}

/**
 * 詳細エラーメッセージを表示する関数
 * @param {HTMLElement} container - コンテナ要素
 * @param {string} message - エラーメッセージ
 */
function showDetailedError( container, message ) {
	const existingDetail = container.querySelector( '.psv-detailed-error' );
	if ( existingDetail ) {
		existingDetail.remove();
		return;
	}

	const detailDiv = document.createElement( 'div' );
	detailDiv.className = 'psv-detailed-error';
	detailDiv.style.cssText = `
        position: absolute;
        top: 50px;
        left: 10px;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 10px 12px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        max-width: 280px;
        width: auto;
        z-index: 1001;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        line-height: 1.5;
        box-sizing: border-box;
    `;

	const detailHTML = `
        <div style="margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #FFA500;">
                お知らせ
            </div>
            <div style="font-size: 12px; color: #fff; line-height: 1.5;">
                WebGLが使用できないためCanvas2Dで表示しています。<br>
                高画質で利用するにはWebGLを有効にしてください。
            </div>
			${
				message
					? `<div style="font-size: 11px; color: #ccc; margin-top: 8px;">${ message }</div>`
					: ''
			}
        </div>
        
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
            <div style="font-size: 10px; color: #999; text-align: center;">
                クリック/タップで閉じる
            </div>
        </div>
    `;

	detailDiv.innerHTML = detailHTML;

	detailDiv.addEventListener( 'click', ( e ) => {
		e.stopPropagation();
		detailDiv.remove();
	} );

	detailDiv.addEventListener( 'touchend', ( e ) => {
		e.stopPropagation();
		detailDiv.remove();
	} );

	container.appendChild( detailDiv );

	setTimeout( () => {
		if ( detailDiv.parentNode ) {
			detailDiv.remove();
		}
	}, 10000 );
}
