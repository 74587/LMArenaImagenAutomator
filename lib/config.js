import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';

const CONFIG_PATH = path.join(process.cwd(), 'config.yaml');

/**
 * 生成随机 API Key
 */
function generateApiKey() {
    return 'sk-' + crypto.randomBytes(24).toString('hex');
}

/**
 * 默认配置模板
 */
function getDefaultConfig() {
    return `# LMArena 配置文件
# 自动生成于 ${new Date().toLocaleString()}

server:
  # 服务器模式: 'openai' (标准兼容) 或 'queue' (流式队列)
  type: queue
  # 监听端口
  port: 3000
  # 鉴权 Token (Bearer Token)
  auth: ${generateApiKey()}

chrome:
  # 浏览器可执行文件路径 (留空则使用Puppeteer默认)
  # Windows系统示例 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  # Linux系统示例 "/usr/bin/chromium"
  # path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  
  # 是否启用无头模式 (true: 后台运行, false: 显示界面)
  headless: false
  
  # 是否启用 GPU (无GPU设备运行请使用false)
  gpu: false
  
  # 代理设置
  proxy:
    # 是否启用代理
    enable: false
    # 代理类型: http 或 socks5
    type: http
    # 代理主机
    host: 127.0.0.1
    # 代理端口
    port: 7890
    # 代理认证 (可选)
    # user: username
    # passwd: password
`;
}

/**
 * 加载配置，如果不存在则自动创建
 */
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log('>>> [Config] 配置文件不存在，正在生成默认配置...');
            const defaultConfig = getDefaultConfig();
            fs.writeFileSync(CONFIG_PATH, defaultConfig, 'utf8');
            console.log(`>>> [Config] 已生成默认配置文件: ${CONFIG_PATH}`);
            console.log('>>> [Config] 请注意查看生成的随机 API Key');
        }

        const configFile = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = yaml.load(configFile);
        console.log('>>> [Config] 已加载 config.yaml');
        return config;
    } catch (e) {
        console.error('>>> [Error] 无法加载或生成配置文件:', e.message);
        process.exit(1);
    }
}

export default loadConfig();
