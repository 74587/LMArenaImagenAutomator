import crypto from 'crypto';

/**
 * 生成随机 API Key
 * 格式: sk- + 32位十六进制字符串
 */
function generateApiKey() {
    const buffer = crypto.randomBytes(16);
    const hex = buffer.toString('hex');
    return `sk-${hex}`;
}

const key = generateApiKey();
console.log('\n=== API Key 生成器 ===');
console.log('您的新 API Key 是:');
console.log('\x1b[32m%s\x1b[0m', key); // 绿色高亮
console.log('\n请将其复制到 config.yaml 的 server.auth 字段中。');
console.log('======================\n');
