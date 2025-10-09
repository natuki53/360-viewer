// デバッグモード（開発時のみtrueに設定）
const DEBUG_MODE = true;

/**
 * イベントハンドラーを管理するクラス
 */
export class EventHandlers {
    constructor(viewer) {
        this.viewer = viewer;
        
        // バインド済みメソッドを保存
        this.boundOnDocumentMouseDown = this.onDocumentMouseDown.bind(this);
        this.boundOnDocumentMouseMove = this.onDocumentMouseMove.bind(this);
        this.boundOnDocumentMouseUp = this.onDocumentMouseUp.bind(this);
        this.boundOnDocumentTouchStart = this.onDocumentTouchStart.bind(this);
        this.boundOnDocumentTouchMove = this.onDocumentTouchMove.bind(this);
        this.boundOnDocumentTouchEnd = this.onDocumentTouchEnd.bind(this);
        this.boundOnWindowResize = this.onWindowResize.bind(this);
        this.boundOnContainerClick = this.onContainerClick.bind(this);
        this.boundHandleBeforeUnload = this.viewer.dispose.bind(this.viewer);
    }
    
    /**
     * イベントリスナーを設定する
     */
    setupEventListeners() {
        const container = this.viewer.container;
        
        container.addEventListener('mousedown', this.boundOnDocumentMouseDown, false);
        container.addEventListener('mousemove', this.boundOnDocumentMouseMove, false);
        container.addEventListener('mouseup', this.boundOnDocumentMouseUp, false);
        container.addEventListener('mouseleave', this.boundOnDocumentMouseUp, false);
        container.addEventListener('touchstart', this.boundOnDocumentTouchStart, false);
        container.addEventListener('touchmove', this.boundOnDocumentTouchMove, false);
        container.addEventListener('touchend', this.boundOnDocumentTouchEnd, false);
        container.addEventListener('click', this.boundOnContainerClick, false);
        
        window.addEventListener('resize', this.boundOnWindowResize, false);
        window.addEventListener('beforeunload', this.boundHandleBeforeUnload);
    }
    
    /**
     * イベントリスナーを削除する
     */
    removeEventListeners() {
        const container = this.viewer.container;
        
        if (container) {
            container.removeEventListener('mousedown', this.boundOnDocumentMouseDown);
            container.removeEventListener('mousemove', this.boundOnDocumentMouseMove);
            container.removeEventListener('mouseup', this.boundOnDocumentMouseUp);
            container.removeEventListener('mouseleave', this.boundOnDocumentMouseUp);
            container.removeEventListener('touchstart', this.boundOnDocumentTouchStart);
            container.removeEventListener('touchmove', this.boundOnDocumentTouchMove);
            container.removeEventListener('touchend', this.boundOnDocumentTouchEnd);
            container.removeEventListener('click', this.boundOnContainerClick);
        }
        
        window.removeEventListener('resize', this.boundOnWindowResize);
        window.removeEventListener('beforeunload', this.boundHandleBeforeUnload);
    }
    
    onWindowResize() {
        if (!this.viewer.camera || !this.viewer.renderer || this.viewer.isDisposed) return;
        
        this.viewer.camera.aspect = this.viewer.container.clientWidth / this.viewer.container.clientHeight;
        this.viewer.camera.updateProjectionMatrix();
        this.viewer.renderer.setSize(this.viewer.container.clientWidth, this.viewer.container.clientHeight);
    }
    
    onDocumentMouseDown(event) {
        if (this.isButtonOrErrorClick(event.target)) {
            return;
        }
        
        event.preventDefault();
        this.viewer.isUserInteracting = true;
        this.viewer.onMouseDownMouseX = event.clientX;
        this.viewer.onMouseDownMouseY = event.clientY;
        this.viewer.onMouseDownLon = this.viewer.lon;
        this.viewer.onMouseDownLat = this.viewer.lat;
        this.stopAutoRotate();
        this.updateCursor();
    }
    
    onDocumentMouseMove(event) {
        if (this.viewer.isUserInteracting) {
            this.viewer.lon = (this.viewer.onMouseDownMouseX - event.clientX) * 0.1 + this.viewer.onMouseDownLon;
            this.viewer.lat = (this.viewer.onMouseDownMouseY - event.clientY) * 0.1 + this.viewer.onMouseDownLat;
        }
        this.updateCursor();
    }
    
    onDocumentMouseUp() {
        if (this.viewer.isUserInteracting) {
            this.viewer.isUserInteracting = false;
            this.restartAutoRotateWithDelay();
            this.updateCursor();
        }
    }
    
    onDocumentTouchStart(event) {
        if (this.isButtonOrErrorTouch(event.target)) {
            return;
        }
        
        if (DEBUG_MODE) {
            console.log('Touch start:', {
                touches: event.touches.length,
                target: event.target.className,
                isMobile: this.viewer.isMobile
            });
        }
        
        if (event.touches.length === 1) {
            event.preventDefault();
            this.viewer.onMouseDownMouseX = event.touches[0].pageX;
            this.viewer.onMouseDownMouseY = event.touches[0].pageY;
            this.viewer.onMouseDownLon = this.viewer.lon;
            this.viewer.onMouseDownLat = this.viewer.lat;
            this.viewer.isUserInteracting = true;
            this.stopAutoRotate();
            this.updateCursor();
        }
    }
    
    onDocumentTouchMove(event) {
        if (this.isButtonOrErrorTouch(event.target)) {
            return;
        }
        
        if (event.touches.length === 1 && this.viewer.isUserInteracting) {
            event.preventDefault();
            this.viewer.lon = (this.viewer.onMouseDownMouseX - event.touches[0].pageX) * 0.15 + this.viewer.onMouseDownLon;
            this.viewer.lat = (this.viewer.onMouseDownMouseY - event.touches[0].pageY) * 0.15 + this.viewer.onMouseDownLat;
        }
        this.updateCursor();
    }
    
    onDocumentTouchEnd(event) {
        if (this.isButtonOrErrorTouch(event.target)) {
            return;
        }
        
        if (this.viewer.isUserInteracting) {
            this.viewer.isUserInteracting = false;
            this.restartAutoRotateWithDelay();
            this.updateCursor();
        }
    }
    
    onContainerClick(e) {
        if (this.isButtonOrErrorClick(e.target)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    }
    
    stopAutoRotate() {
        this.viewer.autoRotate = false;
        if (this.viewer.autoRotateTimeout) {
            clearTimeout(this.viewer.autoRotateTimeout);
            this.viewer.autoRotateTimeout = null;
        }
        this.viewer.lastTime = 0;
    }
    
    restartAutoRotateWithDelay() {
        if (this.viewer.autoRotateTimeout) {
            clearTimeout(this.viewer.autoRotateTimeout);
        }
        this.viewer.autoRotateTimeout = setTimeout(() => {
            this.viewer.autoRotate = true;
            this.viewer.lastTime = 0;
        }, 3000);
    }
    
    updateCursor() {
        if (!this.viewer.container) return;
        
        if (this.viewer.isUserInteracting) {
            this.viewer.container.style.cursor = 'grabbing';
        } else {
            this.viewer.container.style.cursor = 'move';
        }
    }
    
    isButtonOrErrorClick(target) {
        return target === this.viewer.zoomInButton || 
               target === this.viewer.zoomOutButton || 
               (!this.viewer.isMobile && target === this.viewer.fullscreenButton) ||
               target.closest('.psv-error-message') || 
               target.closest('.psv-detailed-error');
    }
    
    isButtonOrErrorTouch(target) {
        return this.isButtonTouch(target) ||
               target.closest('.psv-error-message') || 
               target.closest('.psv-detailed-error');
    }
    
    isButtonTouch(target) {
        return target === this.viewer.zoomInButton || 
               target === this.viewer.zoomOutButton || 
               (!this.viewer.isMobile && target === this.viewer.fullscreenButton) ||
               target.closest('.psv-btn');
    }
}

