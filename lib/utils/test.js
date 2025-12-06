import { getBackend } from '../backend/index.js';
import { getModelsForBackend, resolveModelId } from '../backend/models.js';
import { select, input } from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { logger } from './logger.js';

// 使用统一后端获取配置和函数
const { config, name, TEMP_DIR } = getBackend();

logger.info('CLI/Test', `测试工具启动 (后端适配器: ${name})`);

/**
 * 选择模型
 */
async function selectModel() {
    const models = getModelsForBackend(name);
    const choices = [
        { name: 'Skip（使用默认模型）', value: null },
        ...models.data.map(m => ({ name: m.id, value: m.id }))
    ];

    const modelId = await select({
        message: '选择模型',
        choices,
        pageSize: 15
    });

    return modelId;
}

/**
 * 输入提示词
 */
async function promptForInput() {
    const prompt = await input({
        message: '输入提示词 (必填)',
        validate: (val) => val.trim().length > 0 || '提示词不能为空'
    });
    return prompt.trim();
}

/**
 * 输入图片路径
 */
async function promptForImages() {
    const imagePaths = [];
    while (true) {
        const imgPath = await input({
            message: `输入参考图片路径 (留空跳过，已添加 ${imagePaths.length} 张)`,
        });

        if (!imgPath.trim()) break;

        const cleanPath = imgPath.trim().replace(/^["']|["']$/g, '');
        if (fs.existsSync(cleanPath)) {
            imagePaths.push(cleanPath);
        } else {
            logger.warn('CLI/Test', `图片不存在: ${cleanPath}`);
        }
    }
    return imagePaths;
}

/**
 * HTTP 测试模式 - OpenAI 格式
 */
async function testViaHttpOpenAI(prompt, modelId, imagePaths) {
    const PORT = config.server.port || 3000;
    const AUTH_TOKEN = config.server.auth;
    const KEEPALIVE_ENABLED = config.server.keepalive?.enable ?? true;

    logger.info('CLI/Test', 'HTTP 测试 - OpenAI 模式');
    if (KEEPALIVE_ENABLED) {
        logger.info('CLI/Test', '流式保活已启用，将使用 stream=true');
    }

    return new Promise((resolve, reject) => {
        // 构造请求体
        const messages = [];
        const lastMessage = { role: 'user', content: [] };

        if (prompt) {
            lastMessage.content.push({ type: 'text', text: prompt });
        }

        for (const imgPath of imagePaths) {
            if (fs.existsSync(imgPath)) {
                const buffer = fs.readFileSync(imgPath);
                const base64 = buffer.toString('base64');
                const ext = path.extname(imgPath).slice(1).toLowerCase();
                const mimeType = ext === 'jpg' ? 'jpeg' : ext;
                lastMessage.content.push({
                    type: 'image_url',
                    image_url: { url: `data:image/${mimeType};base64,${base64}` }
                });
            } else {
                logger.warn('CLI/Test', `图片不存在，已跳过: ${imgPath}`);
            }
        }

        messages.push(lastMessage);

        const body = {
            messages,
            stream: KEEPALIVE_ENABLED, // 如果启用 keepalive，必须使用 stream
            ...(modelId && { model: modelId })
        };

        const bodyStr = JSON.stringify(body);

        const options = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        };

        const req = http.request(options, (res) => {
            if (KEEPALIVE_ENABLED) {
                // 流式响应
                let buffer = '';
                let contentReceived = '';

                res.on('data', chunk => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 保留未完成的行

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        // 跳过心跳注释
                        if (line.startsWith(':')) continue;

                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                            if (data === '[DONE]') continue;

                            try {
                                const chunk = JSON.parse(data);
                                if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                                    contentReceived += chunk.choices[0].delta.content;
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve({ choices: [{ message: { content: contentReceived } }] });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            } else {
                // 非流式响应
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const response = JSON.parse(data);
                        resolve(response);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            }
        });

        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

/**
 * 保存图片
 */
function saveImage(base64Data) {
    const testSaveDir = path.join(TEMP_DIR, 'testSave');
    if (!fs.existsSync(testSaveDir)) {
        fs.mkdirSync(testSaveDir, { recursive: true });
    }

    const timestamp = Date.now();
    const savePath = path.join(testSaveDir, `test_${timestamp}.png`);

    // 移除 Data URI 前缀（如果有）
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(savePath, Buffer.from(cleanBase64, 'base64'));

    logger.info('CLI/Test', `图片已保存: ${savePath}`);
    return savePath;
}

/**
 * 主流程
 */
(async () => {
    try {
        logger.info('CLI/Test', '=== HTTP 服务器测试 ===');
        logger.info('CLI/Test', '请确保服务器已启动 (npm start)');

        // 1. 选择模型
        const modelId = await selectModel();
        if (modelId) {
            logger.info('CLI/Test', `选择模型: ${modelId}`);
        } else {
            logger.info('CLI/Test', '跳过模型选择，使用默认');
        }

        // 2. 输入提示词
        const prompt = await promptForInput();
        logger.info('CLI/Test', `提示词: ${prompt}`);

        // 3. 输入图片路径
        const imagePaths = await promptForImages();
        if (imagePaths.length > 0) {
            logger.info('CLI/Test', `参考图片: ${imagePaths.join(', ')}`);
        }

        // 4. 执行测试
        logger.info('CLI/Test', '正在发送请求...');
        const result = await testViaHttpOpenAI(prompt, modelId, imagePaths);

        // 5. 处理响应
        if (result.choices) {
            const content = result.choices[0].message.content;
            logger.info('CLI/Test', `响应内容: ${content.slice(0, 100)}...`);

            // 提取图片（如果有）
            const match = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
            if (match) {
                saveImage(match[1]);
            } else {
                logger.info('CLI/Test', `文本回复: ${content}`);
            }
        }

        logger.info('CLI/Test', '测试完成');
        process.exit(0);

    } catch (err) {
        logger.error('CLI/Test', '测试失败', { error: err.message });
        process.exit(1);
    }
})();