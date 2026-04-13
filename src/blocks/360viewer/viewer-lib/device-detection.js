import { DEBUG_MODE } from './debug-config.js';

// グローバルなデバイス情報（一度だけ判定）
let globalDeviceInfo = null;

/**
 * グローバルなデバイス情報を取得する関数
 * @returns {Object} デバイス情報オブジェクト
 */
export function getGlobalDeviceInfo() {
	if ( globalDeviceInfo ) {
		return globalDeviceInfo;
	}

	globalDeviceInfo = {
		isMobile: detectMobileDevice(),
		isMac: /Mac|Macintosh|MacIntel|MacPPC|Mac68K/i.test(
			navigator.userAgent
		),
		webglSupported: detectWebGLSupport(),
		hardwareAccelerationEnabled: detectHardwareAcceleration(),
		performanceLevel: detectDevicePerformanceLevel(),
		userAgent: navigator.userAgent,
	};

	if ( DEBUG_MODE ) {
		console.log( 'Global device info detected:', globalDeviceInfo );
	}

	return globalDeviceInfo;
}

/**
 * モバイルデバイスを検出する関数
 * @returns {boolean} モバイルデバイスかどうか
 */
export function detectMobileDevice() {
	const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	const mobileUA =
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
	const windowWidth = window.innerWidth;

	const result = {
		hasTouch,
		mobileUA,
		isMac: /Mac|Macintosh|MacIntel|MacPPC|Mac68K/i.test(
			navigator.userAgent
		),
		windowWidth,
		userAgent: navigator.userAgent,
	};

	if ( DEBUG_MODE ) {
		console.log( 'Mobile Detection:', result );
	}

	return hasTouch && ( mobileUA || windowWidth <= 768 );
}

/**
 * WebGLサポートを検出する関数
 * @returns {boolean} WebGLがサポートされているかどうか
 */
export function detectWebGLSupport() {
	try {
		const canvas = document.createElement( 'canvas' );
		const gl =
			canvas.getContext( 'webgl' ) ||
			canvas.getContext( 'experimental-webgl' );

		if ( ! gl ) {
			if ( DEBUG_MODE ) {
				console.warn(
					'WebGL not supported: No WebGL context available'
				);
			}
			return false;
		}

		// モバイルデバイスでは基本的なWebGLコンテキストの取得のみで判定
		if ( globalDeviceInfo && globalDeviceInfo.isMobile ) {
			if ( DEBUG_MODE ) {
				console.log(
					'Mobile device: WebGL context available, skipping advanced tests'
				);
			}
			gl.getExtension( 'WEBGL_lose_context' )?.loseContext();
			return true;
		}

		// デスクトップでは詳細なテストを実行
		const testProgram = gl.createProgram();
		if ( ! testProgram ) {
			if ( DEBUG_MODE ) {
				console.warn(
					'WebGL not supported: Cannot create WebGL program'
				);
			}
			gl.getExtension( 'WEBGL_lose_context' )?.loseContext();
			return false;
		}

		// テスト用のシェーダーを作成
		const vertexShader = gl.createShader( gl.VERTEX_SHADER );
		const fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

		if ( ! vertexShader || ! fragmentShader ) {
			if ( DEBUG_MODE ) {
				console.warn( 'WebGL not supported: Cannot create shaders' );
			}
			gl.deleteProgram( testProgram );
			gl.getExtension( 'WEBGL_lose_context' )?.loseContext();
			return false;
		}

		// リソースをクリーンアップしてコンテキストを解放
		gl.deleteShader( vertexShader );
		gl.deleteShader( fragmentShader );
		gl.deleteProgram( testProgram );
		gl.getExtension( 'WEBGL_lose_context' )?.loseContext();

		if ( DEBUG_MODE ) {
			console.log( 'WebGL support confirmed' );
		}

		return true;
	} catch ( e ) {
		if ( DEBUG_MODE ) {
			console.warn( 'WebGL not supported:', e.message );
		}
		return false;
	}
}

/**
 * デバイス性能レベルを検出する関数
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function detectDevicePerformanceLevel() {
	try {
		const canvas = document.createElement( 'canvas' );
		const gl =
			canvas.getContext( 'webgl' ) ||
			canvas.getContext( 'experimental-webgl' );
		if ( ! gl ) return 'low';

		const level = detectPerformanceLevelFromGL( gl );

		// WebGLコンテキストを明示的に解放してブラウザのコンテキスト枠を節約する
		gl.getExtension( 'WEBGL_lose_context' )?.loseContext();

		return level;
	} catch ( e ) {
		return 'low';
	}
}

/**
 * WebGLコンテキストからデバイス性能レベルを判定する内部ヘルパー
 * @param {WebGLRenderingContext} gl
 * @returns {string} 'high' | 'medium' | 'low'
 */
function detectPerformanceLevelFromGL( gl ) {
	const debugInfo = gl.getExtension( 'WEBGL_debug_renderer_info' );
	if ( ! debugInfo ) return 'medium';

	const renderer = gl.getParameter( debugInfo.UNMASKED_RENDERER_WEBGL );
	const vendor = gl.getParameter( debugInfo.UNMASKED_VENDOR_WEBGL );

	const rendererLower = renderer.toLowerCase();
	const vendorLower = vendor.toLowerCase();

	if ( DEBUG_MODE ) {
		console.log( 'GPU Detection:', {
			vendor: vendor,
			renderer: renderer,
			vendorLower: vendorLower,
			rendererLower: rendererLower,
		} );
	}

	// ソフトウェアレンダリングの場合は低性能
	if (
		rendererLower.includes( 'software' ) ||
		rendererLower.includes( 'llvmpipe' )
	) {
		return 'low';
	}

	// GPUベンダーとモデルによる判定
	if ( vendorLower.includes( 'nvidia' ) ) {
		// NVIDIA GPU
		if (
			rendererLower.includes( 'rtx' ) ||
			rendererLower.includes( 'gtx 10' ) ||
			rendererLower.includes( 'gtx 16' ) ||
			rendererLower.includes( 'gtx 20' ) ||
			rendererLower.includes( 'gtx 30' ) ||
			rendererLower.includes( 'gtx 40' )
		) {
			return 'high';
		} else if (
			rendererLower.includes( 'gtx' ) ||
			rendererLower.includes( 'gt' )
		) {
			return 'medium';
		}
	} else if (
		vendorLower.includes( 'amd' ) ||
		vendorLower.includes( 'ati' )
	) {
		// AMD GPU - 詳細な判定
		if (
			rendererLower.includes( 'rx 6' ) ||
			rendererLower.includes( 'rx 7' ) ||
			rendererLower.includes( 'rx 8' ) ||
			rendererLower.includes( 'radeon rx' )
		) {
			return 'high';
		} else if (
			rendererLower.includes( 'rx 5' ) ||
			rendererLower.includes( 'rx 4' )
		) {
			return 'medium';
		} else if (
			rendererLower.includes( 'rx' ) ||
			rendererLower.includes( 'radeon' )
		) {
			return 'medium';
		} else if (
			rendererLower.includes( 'vega' ) ||
			rendererLower.includes( 'raven ridge' ) ||
			rendererLower.includes( 'picasso' ) ||
			rendererLower.includes( 'renoir' )
		) {
			return 'medium';
		} else if (
			rendererLower.includes( 'radeon r' ) ||
			rendererLower.includes( 'radeon hd' )
		) {
			return 'low';
		}
	} else if ( vendorLower.includes( 'intel' ) ) {
		// Intel GPU - 詳細な判定
		if ( rendererLower.includes( 'arc' ) ) {
			return 'high';
		} else if (
			rendererLower.includes( 'iris xe' ) ||
			rendererLower.includes( 'iris plus' )
		) {
			return 'medium';
		} else if (
			rendererLower.includes( 'uhd' ) ||
			rendererLower.includes( 'hd graphics' )
		) {
			const hdMatch = rendererLower.match( /hd graphics (\d+)/ );
			const uhdMatch =
				rendererLower.match( /uhd graphics (\d+)/ );

			if ( hdMatch ) {
				const hdVersion = parseInt( hdMatch[ 1 ] );
				if ( hdVersion >= 630 ) return 'medium';
				if ( hdVersion >= 520 ) return 'low';
				return 'low';
			} else if ( uhdMatch ) {
				const uhdVersion = parseInt( uhdMatch[ 1 ] );
				if ( uhdVersion >= 750 ) return 'medium';
				if ( uhdVersion >= 630 ) return 'low';
				return 'low';
			} else if (
				rendererLower.includes( 'uhd 7' ) ||
				rendererLower.includes( 'uhd 6' )
			) {
				return 'low';
			} else {
				return 'low';
			}
		} else {
			return 'low';
		}
	} else if ( vendorLower.includes( 'apple' ) ) {
		// Apple Silicon
		if (
			rendererLower.includes( 'apple m1' ) ||
			rendererLower.includes( 'apple m2' ) ||
			rendererLower.includes( 'apple m3' ) ||
			rendererLower.includes( 'apple m4' )
		) {
			return 'high';
		} else {
			return 'medium';
		}
	}

	// モバイルGPUの判定
	if ( rendererLower.includes( 'adreno' ) ) {
		const adrenoMatch = rendererLower.match( /adreno (\d+)/ );
		if ( adrenoMatch ) {
			const adrenoVersion = parseInt( adrenoMatch[ 1 ] );
			if ( adrenoVersion >= 640 ) return 'high';
			if ( adrenoVersion >= 530 ) return 'medium';
			return 'low';
		}
	} else if ( rendererLower.includes( 'mali' ) ) {
		const maliMatch = rendererLower.match( /mali-?g(\d+)/ );
		if ( maliMatch ) {
			const maliVersion = parseInt( maliMatch[ 1 ] );
			if ( maliVersion >= 78 ) return 'high';
			if ( maliVersion >= 52 ) return 'medium';
			return 'low';
		}
	} else if ( rendererLower.includes( 'powervr' ) ) {
		return 'medium';
	}

	// デフォルトは中性能
	return 'medium';
}

/**
 * ハードウェアアクセラレーションを検出する関数（後方互換性のため）
 * @returns {boolean} ハードウェアアクセラレーションが有効かどうか
 */
export function detectHardwareAcceleration() {
	const performanceLevel = detectDevicePerformanceLevel();
	return performanceLevel !== 'low';
}

/**
 * ブラウザ情報を取得する関数
 * @returns {string} ブラウザ名
 */
export function getBrowserInfo() {
	const ua = navigator.userAgent;
	if ( ua.indexOf( 'Chrome' ) > -1 && ua.indexOf( 'Edg' ) === -1 ) {
		return 'Chrome';
	} else if ( ua.indexOf( 'Safari' ) > -1 && ua.indexOf( 'Chrome' ) === -1 ) {
		return 'Safari';
	} else if ( ua.indexOf( 'Firefox' ) > -1 ) {
		return 'Firefox';
	} else if ( ua.indexOf( 'Edg' ) > -1 ) {
		return 'Edge';
	} else {
		return 'その他';
	}
}
