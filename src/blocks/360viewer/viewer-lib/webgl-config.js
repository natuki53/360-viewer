import { getGlobalDeviceInfo } from './device-detection.js';
import { DEBUG_MODE } from './debug-config.js';

// グローバルなWebGL設定（一度だけ決定）
let globalWebGLConfig = null;

/**
 * グローバルなWebGL設定を取得する関数
 * @returns {Object} WebGL設定オブジェクト
 */
export function getGlobalWebGLConfig() {
	if ( globalWebGLConfig ) {
		return globalWebGLConfig;
	}

	const deviceInfo = getGlobalDeviceInfo();

	globalWebGLConfig = {
		rendererOptions: {
			antialias: true,
			preserveDrawingBuffer: true,
			alpha: false,
			depth: true,
			stencil: false,
			logarithmicDepthBuffer: false,
		},
		pixelRatio: 1.0,
	};

	// 性能レベルとモバイル判定を組み合わせた設定
	if ( deviceInfo.isMobile ) {
		if ( deviceInfo.performanceLevel === 'high' ) {
			globalWebGLConfig.rendererOptions.powerPreference =
				'high-performance';
			globalWebGLConfig.rendererOptions.antialias = true;
			globalWebGLConfig.rendererOptions.preserveDrawingBuffer = false;
			globalWebGLConfig.rendererOptions.failIfMajorPerformanceCaveat = false;
			globalWebGLConfig.pixelRatio = Math.min(
				window.devicePixelRatio,
				2.5
			);
			if ( DEBUG_MODE ) {
				console.log(
					'Global WebGL config: High-performance mobile settings'
				);
			}
		} else {
			globalWebGLConfig.rendererOptions.powerPreference = 'low-power';
			globalWebGLConfig.rendererOptions.antialias = false;
			globalWebGLConfig.rendererOptions.preserveDrawingBuffer = false;
			globalWebGLConfig.rendererOptions.failIfMajorPerformanceCaveat = false;
			globalWebGLConfig.pixelRatio = Math.min(
				window.devicePixelRatio,
				2.0
			);
			if ( DEBUG_MODE ) {
				console.log( 'Global WebGL config: Standard mobile settings' );
			}
		}
	} else if ( deviceInfo.hardwareAccelerationEnabled ) {
		if ( deviceInfo.performanceLevel === 'high' ) {
			globalWebGLConfig.rendererOptions.powerPreference =
				'high-performance';
			globalWebGLConfig.rendererOptions.antialias = true;
			if ( deviceInfo.isMac ) {
				globalWebGLConfig.pixelRatio = Math.min(
					window.devicePixelRatio,
					3
				);
			} else {
				globalWebGLConfig.pixelRatio = Math.min(
					window.devicePixelRatio,
					2.5
				);
			}
		} else if ( deviceInfo.performanceLevel === 'medium' ) {
			globalWebGLConfig.rendererOptions.powerPreference = 'low-power';
			globalWebGLConfig.rendererOptions.antialias = false;
			globalWebGLConfig.pixelRatio = Math.min(
				window.devicePixelRatio,
				1.5
			);
		} else {
			globalWebGLConfig.rendererOptions.powerPreference = 'low-power';
			globalWebGLConfig.rendererOptions.antialias = false;
			globalWebGLConfig.pixelRatio = 1;
		}
	} else {
		globalWebGLConfig.rendererOptions.powerPreference = 'low-power';
		globalWebGLConfig.rendererOptions.failIfMajorPerformanceCaveat = false;
		globalWebGLConfig.pixelRatio = 1;
		if ( DEBUG_MODE ) {
			console.warn( 'Global WebGL config: Software rendering mode' );
		}
	}

	if ( DEBUG_MODE ) {
		console.log( 'Global WebGL config:', globalWebGLConfig );
	}

	return globalWebGLConfig;
}

/**
 * 球体のセグメント数を取得する関数
 * @returns {Object} { segments, rings }
 */
export function getSphereGeometryConfig() {
	const deviceInfo = getGlobalDeviceInfo();
	let sphereSegments, sphereRings;

	if ( deviceInfo.isMobile ) {
		if ( deviceInfo.performanceLevel === 'high' ) {
			sphereSegments = 100;
			sphereRings = 70;
		} else {
			sphereSegments = 80;
			sphereRings = 60;
		}
	} else if ( deviceInfo.performanceLevel === 'high' ) {
		sphereSegments = 120;
		sphereRings = 80;
	} else if ( deviceInfo.performanceLevel === 'medium' ) {
		sphereSegments = 90;
		sphereRings = 60;
	} else {
		sphereSegments = 60;
		sphereRings = 40;
	}

	return { segments: sphereSegments, rings: sphereRings };
}

/**
 * テクスチャフィルター設定を取得する関数
 * @param {Object} texture - Three.jsのテクスチャオブジェクト
 * @param {Object} renderer - Three.jsのレンダラーオブジェクト
 */
export function configureTextureFilters( texture, renderer ) {
	const deviceInfo = getGlobalDeviceInfo();

	if ( deviceInfo.hardwareAccelerationEnabled && ! deviceInfo.isMobile ) {
		texture.minFilter = THREE.LinearMipmapLinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.generateMipmaps = true;
		texture.anisotropy = Math.min(
			16,
			renderer.capabilities.getMaxAnisotropy()
		);
	} else {
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.generateMipmaps = false;
	}
}
