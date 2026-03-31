const globalConfig =
	typeof window !== 'undefined' ? window.PSV360Config || {} : {};

export const DEBUG_MODE = globalConfig.debug === true;
