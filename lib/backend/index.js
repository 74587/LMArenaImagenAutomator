import { loadConfig } from '../utils/config.js';
import * as lmarenaBackend from './lmarena.js';
import * as geminiBackend from './gemini_biz.js';
import * as nanobananafreeBackend from './nanobananafree_ai.js';

const config = loadConfig();

let activeBackend;

if (config.backend?.type === 'gemini_biz') {
    activeBackend = {
        name: 'gemini_biz',
        initBrowser: (cfg) => geminiBackend.initBrowser(cfg),
        generateImage: (ctx, prompt, paths, model, meta) => geminiBackend.generateImage(ctx, prompt, paths, model, meta),
        TEMP_DIR: geminiBackend.TEMP_DIR
    };
} else if (config.backend?.type === 'nanobananafree_ai') {
    activeBackend = {
        name: 'nanobananafree_ai',
        initBrowser: (cfg) => nanobananafreeBackend.initBrowser(cfg),
        generateImage: (ctx, prompt, paths, model, meta) => nanobananafreeBackend.generateImage(ctx, prompt, paths, model, meta),
        TEMP_DIR: nanobananafreeBackend.TEMP_DIR
    };
} else {
    activeBackend = {
        name: 'lmarena',
        initBrowser: (cfg) => lmarenaBackend.initBrowser(cfg),
        generateImage: (ctx, prompt, paths, model, meta) => lmarenaBackend.generateImage(ctx, prompt, paths, model, meta),
        TEMP_DIR: lmarenaBackend.TEMP_DIR
    };
}

export function getBackend() {
    return { config, ...activeBackend };
}
