interface FullscreenElement extends Element {
    requestFullscreen: (options?: FullscreenOptions | undefined) => Promise<void>;
    webkitRequestFullscreen?: (options?: FullscreenOptions | undefined) => Promise<void>;
    mozRequestFullScreen?: (options?: FullscreenOptions | undefined) => Promise<void>;
    msRequestFullscreen?: (options?: FullscreenOptions | undefined) => Promise<void>;
}

interface FullscreenDocument extends Document {
    fullscreenElement: Element | null;
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
}

(function() {
    let wasFullscreen: boolean = false;
    let videoElement: HTMLVideoElement | null = null;
    let fullscreenContainer: FullscreenElement | null = null;
    let retryCount: number = 0;
    const maxRetries: number = 10;
    
    console.log('Disney+ Fullscreen Persist: Extension loaded');
    
    // Function to find the video element and fullscreen container
    function findVideoElements(): boolean {
        // Disney+ uses different video selectors
        const videoSelectors: string[] = [
            'video',
            '.btm-media-clients-video',
            '[data-testid="video-player"] video',
            '.dss-media-player video'
        ];
        
        for (const selector of videoSelectors) {
            const vid = document.querySelector(selector) as HTMLVideoElement;
            if (vid) {
                videoElement = vid;
                break;
            }
        }
        
        // Find fullscreen container (usually the video's parent or a specific container)
        if (videoElement) {
            fullscreenContainer = (videoElement.closest('[data-testid="video-player"]') || 
                                videoElement.closest('.btm-media-player') ||
                                videoElement.parentElement) as FullscreenElement;
        }
        
        return !!(videoElement && fullscreenContainer);
    }
    
    // Function to enter fullscreen
    function enterFullscreen(): boolean {
        if (!fullscreenContainer) return false;
        
        try {
            if (fullscreenContainer.requestFullscreen) {
                fullscreenContainer.requestFullscreen();
            } else if (fullscreenContainer.webkitRequestFullscreen) {
                fullscreenContainer.webkitRequestFullscreen();
            } else if (fullscreenContainer.mozRequestFullScreen) {
                fullscreenContainer.mozRequestFullScreen();
            } else if (fullscreenContainer.msRequestFullscreen) {
                fullscreenContainer.msRequestFullscreen();
            }
            return true;
        } catch (error: unknown) {
            console.log('Disney+ Fullscreen Persist: Error entering fullscreen:', error);
            return false;
        }
    }
    
    // Function to check if we're in fullscreen
    function isInFullscreen(): boolean {
        const doc = document as FullscreenDocument;
        return !!(doc.fullscreenElement || 
                 doc.webkitFullscreenElement || 
                 doc.mozFullScreenElement || 
                 doc.msFullscreenElement);
    }
    
    // Main fullscreen handler
    function handleFullscreenChange(): void {
        const currentlyFullscreen: boolean = isInFullscreen();
        
        console.log('Disney+ Fullscreen Persist: Fullscreen change detected', {
            wasFullscreen,
            currentlyFullscreen,
            retryCount
        });
        
        if (wasFullscreen && !currentlyFullscreen) {
            // We were in fullscreen but now we're not - try to restore it
            console.log('Disney+ Fullscreen Persist: Attempting to restore fullscreen');
            
            // Small delay to let Disney+ finish its episode transition
            setTimeout(() => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    
                    // Make sure we still have valid elements
                    if (!findVideoElements()) {
                        console.log('Disney+ Fullscreen Persist: Re-scanning for video elements');
                        // Try again after a longer delay
                        setTimeout(() => {
                            if (findVideoElements()) {
                                enterFullscreen();
                            }
                        }, 1000);
                    } else {
                        enterFullscreen();
                    }
                } else {
                    console.log('Disney+ Fullscreen Persist: Max retries reached, giving up');
                    retryCount = 0;
                }
            }, 500);
        } else if (currentlyFullscreen) {
            // We successfully entered fullscreen
            retryCount = 0;
        }
        
        wasFullscreen = currentlyFullscreen;
    }
    
    // Initialize the extension
    function init(): void {
        console.log('Disney+ Fullscreen Persist: Initializing...');
        
        // Find video elements
        if (!findVideoElements()) {
            // If elements not found, try again after page loads more
            setTimeout(init, 2000);
            return;
        }
        
        console.log('Disney+ Fullscreen Persist: Video elements found, setting up listeners');
        
        // Set initial state
        wasFullscreen = isInFullscreen();
        
        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // Also listen for video changes (episode switches)
        if (videoElement) {
            videoElement.addEventListener('loadstart', () => {
                console.log('Disney+ Fullscreen Persist: Video loading new content');
                // Reset retry count for new episode
                retryCount = 0;
                
                // Re-find elements in case DOM structure changed
                setTimeout(() => {
                    findVideoElements();
                }, 1000);
            });
        }
        
        // Listen for DOM changes to catch dynamic content loading
        const observer = new MutationObserver((mutations: MutationRecord[]) => {
            mutations.forEach((mutation: MutationRecord) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if new video elements were added
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as Element;
                            if (element.matches('video') || element.querySelector('video')) {
                                console.log('Disney+ Fullscreen Persist: New video element detected');
                                setTimeout(() => findVideoElements(), 500);
                                break;
                            }
                        }
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Disney+ Fullscreen Persist: Extension initialized successfully');
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();