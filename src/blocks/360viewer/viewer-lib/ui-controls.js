/**
 * UI コントロールを管理するクラス
 */
export class UIControls {
    constructor(viewer) {
        this.viewer = viewer;
        
        // ボタンイベントハンドラーの保存用
        this.boundZoomInClick = null;
        this.boundZoomOutClick = null;
        this.boundZoomInTouch = null;
        this.boundZoomOutTouch = null;
        this.boundFullscreenClick = null;
    }
    
    /**
     * コントロールボタンを作成する
     */
    createControls() {
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'psv-controls-container';
        this.viewer.container.appendChild(this.controlsContainer);
        
        this.createZoomButtons();
        
        if (!this.viewer.isMobile) {
            this.createFullscreenButton();
        }
    }
    
    /**
     * ズームボタンを作成する
     */
    createZoomButtons() {
        // ズームインボタン
        this.viewer.zoomInButton = document.createElement('button');
        this.viewer.zoomInButton.className = 'psv-btn psv-zoom-btn psv-zoom-in-btn';
        this.viewer.zoomInButton.title = 'ズームイン';
        this.viewer.zoomInButton.innerHTML = '+';
        this.viewer.zoomInButton.style.pointerEvents = 'auto';
        this.viewer.zoomInButton.style.position = 'absolute';
        this.viewer.zoomInButton.style.zIndex = '100';
        
        this.boundZoomInClick = (e) => {
            e.stopPropagation();
            this.zoomIn();
        };
        this.viewer.zoomInButton.onclick = this.boundZoomInClick;
        
        this.boundZoomInTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.zoomIn();
        };
        this.viewer.zoomInButton.addEventListener('touchend', this.boundZoomInTouch, { passive: false });
        this.viewer.container.appendChild(this.viewer.zoomInButton);
        
        // ズームアウトボタン
        this.viewer.zoomOutButton = document.createElement('button');
        this.viewer.zoomOutButton.className = 'psv-btn psv-zoom-btn psv-zoom-out-btn';
        this.viewer.zoomOutButton.title = 'ズームアウト';
        this.viewer.zoomOutButton.innerHTML = '−';
        this.viewer.zoomOutButton.style.pointerEvents = 'auto';
        this.viewer.zoomOutButton.style.position = 'absolute';
        this.viewer.zoomOutButton.style.zIndex = '100';
        
        this.boundZoomOutClick = (e) => {
            e.stopPropagation();
            this.zoomOut();
        };
        this.viewer.zoomOutButton.onclick = this.boundZoomOutClick;
        
        this.boundZoomOutTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.zoomOut();
        };
        this.viewer.zoomOutButton.addEventListener('touchend', this.boundZoomOutTouch, { passive: false });
        this.viewer.container.appendChild(this.viewer.zoomOutButton);
    }
    
    /**
     * フルスクリーンボタンを作成する
     */
    createFullscreenButton() {
        this.viewer.fullscreenButton = document.createElement('button');
        this.viewer.fullscreenButton.className = 'psv-btn psv-fullscreen-btn';
        this.viewer.fullscreenButton.title = 'フルスクリーン';
        this.viewer.fullscreenButton.innerHTML = '⛶';
        this.viewer.fullscreenButton.style.pointerEvents = 'auto';
        this.viewer.fullscreenButton.style.position = 'absolute';
        this.viewer.fullscreenButton.style.zIndex = '100';
        
        this.boundFullscreenClick = (e) => {
            e.stopPropagation();
            if (this.viewer.fullscreenManager) {
                this.viewer.fullscreenManager.toggleFullscreen();
            }
        };
        this.viewer.fullscreenButton.onclick = this.boundFullscreenClick;
        
        this.viewer.container.appendChild(this.viewer.fullscreenButton);
    }
    
    /**
     * ズームイン処理
     */
    zoomIn() {
        if (!this.viewer.camera || this.viewer.isDisposed) return;
        this.viewer.camera.fov = Math.max(30, this.viewer.camera.fov - 10);
        this.viewer.camera.updateProjectionMatrix();
        
        if (this.viewer.renderer && this.viewer.renderer.isCanvas2D) {
            this.viewer.renderer.render(this.viewer.scene, this.viewer.camera);
        }
    }
    
    /**
     * ズームアウト処理
     */
    zoomOut() {
        if (!this.viewer.camera || this.viewer.isDisposed) return;
        this.viewer.camera.fov = Math.min(90, this.viewer.camera.fov + 10);
        this.viewer.camera.updateProjectionMatrix();
        
        if (this.viewer.renderer && this.viewer.renderer.isCanvas2D) {
            this.viewer.renderer.render(this.viewer.scene, this.viewer.camera);
        }
    }
    
    /**
     * ボタンイベントリスナーを削除する
     */
    removeEventListeners() {
        if (this.viewer.zoomInButton) {
            if (this.boundZoomInClick) {
                this.viewer.zoomInButton.onclick = null;
            }
            if (this.boundZoomInTouch) {
                this.viewer.zoomInButton.removeEventListener('touchend', this.boundZoomInTouch);
            }
        }
        
        if (this.viewer.zoomOutButton) {
            if (this.boundZoomOutClick) {
                this.viewer.zoomOutButton.onclick = null;
            }
            if (this.boundZoomOutTouch) {
                this.viewer.zoomOutButton.removeEventListener('touchend', this.boundZoomOutTouch);
            }
        }
        
        if (this.viewer.fullscreenButton) {
            if (this.boundFullscreenClick) {
                this.viewer.fullscreenButton.onclick = null;
            }
        }
    }
    
    /**
     * ボタンを削除する
     */
    dispose() {
        this.removeEventListeners();
        
        if (this.viewer.zoomInButton && this.viewer.zoomInButton.parentNode) {
            this.viewer.zoomInButton.parentNode.removeChild(this.viewer.zoomInButton);
        }
        if (this.viewer.zoomOutButton && this.viewer.zoomOutButton.parentNode) {
            this.viewer.zoomOutButton.parentNode.removeChild(this.viewer.zoomOutButton);
        }
        if (this.viewer.fullscreenButton && this.viewer.fullscreenButton.parentNode) {
            this.viewer.fullscreenButton.parentNode.removeChild(this.viewer.fullscreenButton);
        }
        
        if (this.controlsContainer && this.viewer.container.contains(this.controlsContainer)) {
            this.viewer.container.removeChild(this.controlsContainer);
        }
        
        this.viewer.zoomInButton = null;
        this.viewer.zoomOutButton = null;
        this.viewer.fullscreenButton = null;
        this.controlsContainer = null;
    }
}

