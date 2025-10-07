// THREE変数はグローバルスコープから利用

// WebGLコンテキストの管理用
const MAX_ACTIVE_VIEWERS = 3; // 同時に表示する最大ビューアー数
const activeViewers = new Set();

class PanoramaViewer {
    constructor(container, imageUrl) {
        this.container = container;
        this.imageUrl = imageUrl;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.isUserInteracting = false;
        this.onMouseDownMouseX = 0;
        this.onMouseDownMouseY = 0;
        this.lon = 90;
        this.lat = 0;
        this.onMouseDownLon = 0;
        this.onMouseDownLat = 0;
        this.phi = 0;
        this.theta = 0;
        this.autoRotate = true;
        this.autoRotateTimeout = null;
        this.isFullscreen = false;
        this.isDisposed = false;

        // 時間ベースの自動回転用（フレームレート非依存）
        this.lastTime = 0;
        this.autoRotateSpeed = 3;

        // スマホ判定
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                       window.innerWidth <= 768;

        // Intersection Observer の設定
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.activate();
                    } else {
                        this.deactivate();
                    }
                });
            },
            { threshold: 0.1 } // 10%以上表示されたら反応
        );

        this.init();
    }

    init() {
        // シーンの作成
        this.scene = new THREE.Scene();

        // カメラの作成
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 1, 1100);
        this.camera.target = new THREE.Vector3(0, 0, 0);

        // レンダラーの作成（既存のWebGLコンテキストの再利用を試みる）
        this.renderer = this.createRenderer();
        this.container.appendChild(this.renderer.domElement);

        // コントロールボタンのコンテナ作成
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'psv-controls-container';
        this.container.appendChild(this.controlsContainer);

        // 16:9画像用に調整した球体ジオメトリの作成
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        // テクスチャの読み込みと調整
        const textureLoader = new THREE.TextureLoader();
        textureLoader.encoding = THREE.sRGBEncoding;  // テクスチャローダーにもsRGB設定を適用
        
        const texture = textureLoader.load(this.imageUrl, () => {
            texture.encoding = THREE.sRGBEncoding;  // テクスチャにもsRGB設定を適用
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.x = 1.0;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;  // ミップマップを無効化して元の色を保持
            
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide
            });
            
            this.sphere = new THREE.Mesh(geometry, material);
            this.scene.add(this.sphere);
        });

        // Intersection Observer の開始
        this.observer.observe(this.container);

        // イベントリスナーの設定
        this.setupEventListeners();

        // アクティブビューアーとして登録
        this.activate();
    }

    // WebGLレンダラーの作成（コンテキストの再利用を試みる）
    createRenderer() {
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'low-power', // パフォーマンスと電力消費のバランスを取る
            preserveDrawingBuffer: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // デバイスピクセル比を制限
        renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        
        // 色空間の設定
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.gammaFactor = 2.2;
        renderer.gammaOutput = true;

        return renderer;
    }

    // ビューアーのアクティブ化
    activate() {
        if (this.isDisposed) return;

        // アクティブビューアーが多すぎる場合、最も古いものを非アクティブ化
        if (activeViewers.size >= MAX_ACTIVE_VIEWERS) {
            const oldestViewer = Array.from(activeViewers)[0];
            oldestViewer.deactivate();
        }

        activeViewers.add(this);
        this.startAnimation();
    }

    // ビューアーの非アクティブ化
    deactivate() {
        if (this.isDisposed) return;

        activeViewers.delete(this);
        this.stopAnimation();
    }

    // アニメーションの開始
    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    // アニメーションの停止
    stopAnimation() {
        this.isAnimating = false;
    }

    // リソースの解放
    dispose() {
        if (this.isDisposed) return;

        this.isDisposed = true;
        this.deactivate();
        this.observer.disconnect();

        // Three.jsのリソース解放
        if (this.sphere) {
            this.sphere.geometry.dispose();
            this.sphere.material.map?.dispose();
            this.sphere.material.dispose();
            this.scene.remove(this.sphere);
        }

        if (this.scene) {
            this.scene.clear();
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        // イベントリスナーの削除
        this.removeEventListeners();

        // DOM要素の削除
        if (this.controlsContainer) {
            this.container.removeChild(this.controlsContainer);
        }

        // 参照の解放
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.controlsContainer = null;
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // フルスクリーンボタンの追加（PC のみ）
        if (!this.isMobile) {
            this.fullscreenButton = document.createElement('button');
            this.fullscreenButton.className = 'psv-btn psv-fullscreen-btn';
            this.fullscreenButton.title = 'フルスクリーン';
            this.fullscreenButton.innerHTML = '⛶'; // フルスクリーン開始アイコン
            
            // クリックイベント
            this.fullscreenButton.onclick = (e) => {
                e.stopPropagation();
                console.log('フルスクリーンボタン onclick');
                this.toggleFullscreen();
            };
            
            this.container.appendChild(this.fullscreenButton);
        }

        // ズームインボタンの追加（左下）
        this.zoomInButton = document.createElement('button');
        this.zoomInButton.className = 'psv-btn psv-zoom-btn psv-zoom-in-btn';
        this.zoomInButton.title = 'ズームイン';
        this.zoomInButton.innerHTML = '+';
        this.zoomInButton.onclick = (e) => {
            e.stopPropagation();
            this.zoomIn();
        };
        // スマホ用タッチイベント
        this.zoomInButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.zoomIn();
        }, { passive: false });
        this.container.appendChild(this.zoomInButton);

        // ズームアウトボタンの追加（左下）
        this.zoomOutButton = document.createElement('button');
        this.zoomOutButton.className = 'psv-btn psv-zoom-btn psv-zoom-out-btn';
        this.zoomOutButton.title = 'ズームアウト';
        this.zoomOutButton.innerHTML = '−';
        this.zoomOutButton.onclick = (e) => {
            e.stopPropagation();
            this.zoomOut();
        };
        // スマホ用タッチイベント
        this.zoomOutButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.zoomOut();
        }, { passive: false });
        this.container.appendChild(this.zoomOutButton);

        // イベントリスナーの設定
        this.container.addEventListener('mousedown', this.onDocumentMouseDown.bind(this), false);
        this.container.addEventListener('mousemove', this.onDocumentMouseMove.bind(this), false);
        this.container.addEventListener('mouseup', this.onDocumentMouseUp.bind(this), false);
        this.container.addEventListener('mouseleave', this.onDocumentMouseUp.bind(this), false);
        this.container.addEventListener('touchstart', this.onDocumentTouchStart.bind(this), false);
        this.container.addEventListener('touchmove', this.onDocumentTouchMove.bind(this), false);
        this.container.addEventListener('touchend', this.onDocumentTouchEnd.bind(this), false);
        
        // クリックイベントをキャンセル（ズーム防止）
        this.container.addEventListener('click', (e) => {
            // ボタン以外のクリックをキャンセル
            if (e.target !== this.zoomInButton && 
                e.target !== this.zoomOutButton && 
                (!this.isMobile && e.target !== this.fullscreenButton)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, false);
        
        // カーソル初期設定
        this.updateCursor();

        // リサイズイベントの設定
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // フルスクリーン状態変更の監視（PC のみ）
        if (!this.isMobile) {
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));

            // ESCキーで終了
            document.addEventListener('keydown', this.handleEscapeKey.bind(this));
        }

        // ページ遷移時のクリーンアップ
        window.addEventListener('beforeunload', this.dispose.bind(this));
    }

    // イベントリスナーの削除
    removeEventListeners() {
        // ボタンエリアでのタッチイベントは無視する
        if (this.isButtonTouch(event.target)) {
            return;
        }
        
        if (event.touches.length === 1 && this.isUserInteracting) {
            event.preventDefault();
            this.lon = (this.onMouseDownMouseX - event.touches[0].pageX) * 0.15 + this.onMouseDownLon;
            this.lat = (event.touches[0].pageY - this.onMouseDownMouseY) * 0.15 + this.onMouseDownLat;
        }
        this.updateCursor();

        window.removeEventListener('resize', this.onWindowResize.bind(this));
        window.removeEventListener('keydown', this.handleEscapeKey.bind(this));
        window.removeEventListener('beforeunload', this.dispose.bind(this));
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    onDocumentMouseDown(event) {
        // ズームボタンやフルスクリーンボタンのクリックは処理しない
        if (event.target === this.zoomInButton || 
            event.target === this.zoomOutButton || 
            (!this.isMobile && event.target === this.fullscreenButton)) {
            return;
        }
        
        event.preventDefault();
        this.isUserInteracting = true;
        this.onMouseDownMouseX = event.clientX;
        this.onMouseDownMouseY = event.clientY;
        this.onMouseDownLon = this.lon;
        this.onMouseDownLat = this.lat;
        this.stopAutoRotate();
        this.updateCursor();
    }

    onDocumentMouseMove(event) {
        if (this.isUserInteracting) {
            this.lon = (this.onMouseDownMouseX - event.clientX) * 0.1 + this.onMouseDownLon;
            this.lat = (event.clientY - this.onMouseDownMouseY) * 0.1 + this.onMouseDownLat;
        }
        this.updateCursor();
    }

    onDocumentMouseUp() {
        if (this.isUserInteracting) {
            this.isUserInteracting = false;
            this.restartAutoRotateWithDelay();
            this.updateCursor();
        }
    }

    onDocumentTouchStart(event) {
        // ボタンエリアでのタッチイベントは無視する
        if (this.isButtonTouch(event.target)) {
            return;
        }
        
        if (event.touches.length === 1) {
            event.preventDefault();
            this.onMouseDownMouseX = event.touches[0].pageX;
            this.onMouseDownMouseY = event.touches[0].pageY;
            this.onMouseDownLon = this.lon;
            this.onMouseDownLat = this.lat;
            this.isUserInteracting = true;
            this.stopAutoRotate();
            this.updateCursor();
        }
    }

    onDocumentTouchMove(event) {
        // ボタンエリアでのタッチイベントは無視する
        if (this.isButtonTouch(event.target)) {
            return;
        }
        
        if (event.touches.length === 1 && this.isUserInteracting) {
            event.preventDefault();
            this.lon = (this.onMouseDownMouseX - event.touches[0].pageX) * 0.15 + this.onMouseDownLon;
            this.lat = (event.touches[0].pageY - this.onMouseDownMouseY) * 0.15 + this.onMouseDownLat;
        }
        this.updateCursor();
    }

    onDocumentTouchEnd(event) {
        // ボタンエリアでのタッチイベントは無視する
        if (this.isButtonTouch(event.target)) {
            return;
        }
        
        if (this.isUserInteracting) {
            this.isUserInteracting = false;
            this.restartAutoRotateWithDelay();
            this.updateCursor();
        }
    }

    stopAutoRotate() {
        this.autoRotate = false;
        if (this.autoRotateTimeout) {
            clearTimeout(this.autoRotateTimeout);
            this.autoRotateTimeout = null;
        }
        // 自動回転停止時に時間をリセット
        this.lastTime = 0;
    }

    restartAutoRotateWithDelay() {
        if (this.autoRotateTimeout) {
            clearTimeout(this.autoRotateTimeout);
        }
        this.autoRotateTimeout = setTimeout(() => {
            this.autoRotate = true;
            // 自動回転再開時に時間をリセット
            this.lastTime = 0;
        }, 3000);
    }

    updateCursor() {
        if (this.isUserInteracting) {
            this.container.style.cursor = 'grabbing';
        } else {
            this.container.style.cursor = 'move';
        }
    }

    toggleFullscreen() {
        // スマホではフルスクリーン機能を無効化
        if (this.isMobile) {
            return;
        }
        
        console.log('フルスクリーンボタンがクリックされました'); // デバッグ用
        
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        // スマホではフルスクリーン機能を無効化
        if (this.isMobile) {
            return;
        }
        
        console.log('フルスクリーン開始');
        
        // 画面回転を横向きに固定（対応ブラウザのみ）
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(err => {
                console.log('画面回転ロックに失敗:', err);
            });
        }

        // 元の状態を保存
        this.originalParent = this.container.parentNode;
        this.originalNextSibling = this.container.nextSibling;
        this.originalPosition = this.container.style.position;
        this.originalTop = this.container.style.top;
        this.originalLeft = this.container.style.left;
        this.originalWidth = this.container.style.width;
        this.originalHeight = this.container.style.height;
        this.originalZIndex = this.container.style.zIndex;
        this.originalBackground = this.container.style.backgroundColor;

        // フルスクリーンオーバーレイを作成
        this.fullscreenOverlay = document.createElement('div');
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
        this.container.style.position = 'relative';
        this.container.style.width = '100vw';
        this.container.style.height = '100vh';
        this.container.style.paddingTop = '0';
        this.container.style.maxWidth = 'none';
        this.container.style.maxHeight = 'none';
        this.container.style.backgroundColor = '#000';

        // オーバーレイにビューアーを移動
        this.fullscreenOverlay.appendChild(this.container);
        document.body.appendChild(this.fullscreenOverlay);

        // 真のフルスクリーンを試行
        this.tryTrueFullscreen();

        this.isFullscreen = true;
        this.onFullscreenChange();

        // スクロール防止
        document.body.style.overflow = 'hidden';
        
        // フルスクリーン時のみタッチスクロール防止（iOS対応）
        document.addEventListener('touchmove', this.preventScroll, { passive: false });
    }

    tryTrueFullscreen() {
        // document.documentElement をフルスクリーンにして真のフルスクリーンを実現
        const docElement = document.documentElement;
        
        if (docElement.requestFullscreen) {
            docElement.requestFullscreen().catch(err => {
                console.log('documentElement.requestFullscreen 失敗:', err);
                this.tryAlternativeFullscreen();
            });
        } else if (docElement.webkitRequestFullscreen) {
            docElement.webkitRequestFullscreen();
        } else if (docElement.mozRequestFullScreen) {
            docElement.mozRequestFullScreen();
        } else if (docElement.msRequestFullscreen) {
            docElement.msRequestFullscreen();
        } else {
            console.log('フルスクリーンAPIが対応していません');
            this.tryAlternativeFullscreen();
        }
    }

    tryAlternativeFullscreen() {
        // モバイルブラウザでの代替フルスクリーン
        console.log('代替フルスクリーンモード');
        
        // ビューポートの制御
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            this.originalViewport = viewport.getAttribute('content');
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        // iOS Safari の場合のアドレスバー非表示
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            setTimeout(() => {
                window.scrollTo(0, 1);
            }, 100);
        }
    }

    preventScroll(e) {
        e.preventDefault();
        return false;
    }

    exitFullscreen() {
        console.log('フルスクリーン終了');
        
        // 画面回転ロックを解除
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }

        // ビューポートを元に戻す
        if (this.originalViewport) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', this.originalViewport);
            }
        }

        // スクロール防止を解除
        document.body.style.overflow = '';
        document.removeEventListener('touchmove', this.preventScroll);
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));

        // ビューアーを元の位置に戻す
        if (this.originalParent) {
            this.container.style.position = this.originalPosition;
            this.container.style.top = this.originalTop;
            this.container.style.left = this.originalLeft;
            this.container.style.width = this.originalWidth;
            this.container.style.height = this.originalHeight;
            this.container.style.zIndex = this.originalZIndex;
            this.container.style.backgroundColor = this.originalBackground;
            this.container.style.paddingTop = '56.25%'; // 元の16:9比率に戻す
            this.container.style.maxWidth = '';
            this.container.style.maxHeight = '';

            // 元の親要素に戻す
            if (this.originalNextSibling) {
                this.originalParent.insertBefore(this.container, this.originalNextSibling);
            } else {
                this.originalParent.appendChild(this.container);
            }
        }

        // オーバーレイを削除
        if (this.fullscreenOverlay) {
            this.fullscreenOverlay.remove();
            this.fullscreenOverlay = null;
        }

        // 真のフルスクリーンを終了
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.log('フルスクリーン終了失敗:', err);
            });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        this.isFullscreen = false;
        this.onFullscreenChange();

        // リサイズイベントを発火して描画を更新
        setTimeout(() => {
            this.onWindowResize();
        }, 100);
    }

    onFullscreenChange() {
        // フルスクリーン状態変更時の処理
        this.onWindowResize();
        
        // ボタンテキストを更新（PC のみ）
        if (!this.isMobile && this.fullscreenButton) {
            if (this.isFullscreen) {
                // フルスクリーン終了アイコン
                this.fullscreenButton.innerHTML = '✕'; // ×マーク（終了）
                this.fullscreenButton.title = 'フルスクリーン終了';
            } else {
                // フルスクリーン開始アイコン
                this.fullscreenButton.innerHTML = '⛶'; // フルスクリーン開始アイコン
                this.fullscreenButton.title = 'フルスクリーン';
            }
        }
    }

    animate() {
        if (!this.isAnimating || this.isDisposed) return;

        requestAnimationFrame(this.animate.bind(this));
        this.update();
    }

    update() {
        // 時間ベースの自動回転（フレームレート非依存）
        if (this.autoRotate && !this.isUserInteracting) {
            const currentTime = performance.now();
            if (this.lastTime > 0) {
                const deltaTime = (currentTime - this.lastTime) / 1000; // 秒に変換
                this.lon += this.autoRotateSpeed * deltaTime; // 時間に比例した回転
            }
            this.lastTime = currentTime;
        } else {
            // 自動回転が停止している間は時間をリセット
            this.lastTime = performance.now();
        }

        this.lat = Math.max(-85, Math.min(85, this.lat));
        this.phi = THREE.MathUtils.degToRad(90 - this.lat);
        this.theta = THREE.MathUtils.degToRad(this.lon);

        this.camera.position.x = 100 * Math.sin(this.phi) * Math.cos(this.theta);
        this.camera.position.y = 100 * Math.cos(this.phi);
        this.camera.position.z = 100 * Math.sin(this.phi) * Math.sin(this.theta);

        this.camera.lookAt(this.camera.target);
        this.renderer.render(this.scene, this.camera);
    }

    zoomIn() {
        this.camera.fov = Math.max(30, this.camera.fov - 10);
        this.camera.updateProjectionMatrix();
    }

    zoomOut() {
        this.camera.fov = Math.min(90, this.camera.fov + 10);
        this.camera.updateProjectionMatrix();
    }

    // ボタンタッチかどうかを判定するヘルパーメソッド
    isButtonTouch(target) {
        return target === this.zoomInButton || 
               target === this.zoomOutButton || 
               (!this.isMobile && target === this.fullscreenButton) ||
               target.closest('.psv-btn'); // ボタンの子要素も考慮
    }

    handleFullscreenChange() {
        // スマホではフルスクリーン機能を無効化
        if (this.isMobile) {
            return;
        }
        
        // ブラウザのフルスクリーン状態をチェック
        const isCurrentlyFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
        
        this.isFullscreen = isCurrentlyFullscreen;
        this.onFullscreenChange();
    }

    handleEscapeKey(e) {
        // スマホではフルスクリーン機能を無効化
        if (this.isMobile) {
            return;
        }
        
        if (e.key === 'Escape' && this.isFullscreen) {
            this.exitFullscreen();
        }
    }
}

// ビューアーの初期化
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

    // ページ遷移時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        viewers.forEach(viewer => viewer.dispose());
        viewers.clear();
    });
}); 