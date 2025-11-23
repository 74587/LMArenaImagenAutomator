# LMArenaImagenAutomator - 使用文档

## 📝 项目简介

LMArenaImagenAutomator 是一个基于 Puppeteer 的自动化图像生成工具，通过模拟人类操作与 LMArena 网站交互，提供图像生成服务。项目支持两种运行模式：
- **OpenAI 兼容模式**：提供标准的 OpenAI API 接口，便于集成到现有应用
- **Queue 队列模式**：使用 Server-Sent Events (SSE) 实时推送生成状态

### ✨ 主要特性

- 🎭 **拟人化操作**：使用贝塞尔曲线模拟真实鼠标移动轨迹
- 🤖 **智能输入**：模拟人类打字速度和错误纠正行为
- 🖼️ **多图支持**：最多支持同时上传 5 张参考图片
- 🔐 **安全认证**：基于 Bearer Token 的 API 鉴权
- 📊 **队列管理**：智能任务队列，防止请求过载
- 🌐 **代理支持**：支持 HTTP 和 SOCKS5 代理配置

---

## 🚀 快速开始

### 系统要求

- **Node.js**: 16.0 或更高版本
- **操作系统**: Windows、Linux 或 macOS
- **浏览器**: Google Chrome 或 Chromium (可选，Puppeteer 会自动下载)

### 安装步骤

1. **克隆项目**（如果从仓库获取）或解压项目文件

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **生成 API 密钥**
   ```bash
   npm run genkey
   ```
   此命令会生成一个安全的随机密钥，请保存并配置到 `config.yaml` 中。

---

## ⚙️ 配置说明

### config.yaml 配置文件

配置文件位于项目根目录下的 `config.yaml`，包含以下主要配置项：

#### 服务器配置
```yaml
server:
  # 运行模式: 'openai' (OpenAI 兼容) 或 'queue' (SSE 队列)
  type: queue
  # 监听端口
  port: 3000
  # API 鉴权密钥 (使用 npm run genkey 生成)
  auth: sk-change-me-to-your-secure-key
```

#### 浏览器配置
```yaml
chrome:
  # Chrome 可执行文件路径 (留空使用 Puppeteer 内置版本)
  # Windows 示例: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  # Linux 示例: "/usr/bin/chromium"
  path: ""
  
  # 是否启用无头模式 (true = 后台运行，false = 显示浏览器)
  headless: false
  
  # 是否启用 GPU 加速 (无显卡服务器设为 false)
  gpu: false
```

#### 代理配置
```yaml
chrome:
  proxy:
    # 是否启用代理
    enable: false
    # 代理类型: 'http' 或 'socks5'
    type: http
    # 代理服务器地址
    host: 127.0.0.1
    # 代理端口
    port: 7890
    # 代理认证 (可选)
    # user: username
    # passwd: password
```

### 重要配置建议

| 配置项 | 建议值 | 说明 |
|-------|--------|------|
| `server.type` | `queue` | 使用队列模式可获得实时状态反馈 |
| `server.auth` | 强密钥 | 务必修改默认值，使用 `npm run genkey` 生成 |
| `chrome.headless` | `false` / `true` | 建议保持非无头模式（true已映射为new模式） |
| `chrome.gpu` | `false` / `true` | 无显卡环境强烈建议关闭 |

---

## 📖 使用方法

### 【重要】务必进行的步骤
- 第一次启动程序时必须关闭无头模式启动（**Linux无界面请看文档结尾**）
- 等待网页加载完毕后登录账号（否则会在使用几次后弹出登录界面阻止操作）
- 点击输入框输入任意内容点发送，等待弹出服务条款和CloudFlare Turnstile验证码
- 点击验证码并同意条款后再次点击发送，此时可能会弹出reCAPTCHA验证码，若出现也将其通过
- 后续可改为无头模式运行，但建议使用非无头模式避免频繁触发人机验证码


### 方式一：使用 HTTP API

**启动服务器**
```bash
npm start
```

#### OpenAI 兼容模式
> [!WARNING]
> 由于模拟真实用户的浏览器操作，一次只能进行一个任务，剩下的将会放入队列中等待，为防止客户端超时影响体验，该模式如果已经有3个任务时后来的任务将会直接返回错误代码，推荐使用Queue队列模式，服务器会向客户端发送心跳包以确保连接存活。

**配置文件设置**
```yaml
server:
  type: openai
  port: 3000
  auth: your-secret-key
```

**API 请求示例**
```bash
curl -X POST http://127.0.0.1:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-key" \
  -d '{
    "messages": [
      {
        "type": "text",
        "text": "generate a cat"
      }
    ]
  }'
```

**响应格式**
```json
{
  "id": "chatcmpl-1732374740123",
  "object": "chat.completion",
  "created": 1732374740,
  "model": "lmarena-image",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "![generated](data:image/jpeg;base64,/9j/4AAQ...)"
    },
    "finish_reason": "stop"
  }]
}
```

#### Queue 队列模式（SSE）（推荐）

**配置文件设置**
```yaml
server:
  type: queue
```

**请求端点**
```
POST http://127.0.0.1:3000/v1/queue/join
```

**SSE 事件类型**

| 事件类型 | 数据格式 | 说明 |
|---------|---------|------|
| `status` | `{status: "queued", position: 1}` | 任务已入队 |
| `status` | `{status: "processing"}` | 开始处理 |
| `result` | `{status: "completed", image: "base64..."}` | 生成成功 |
| `result` | `{status: "error", msg: "错误信息"}` | 生成失败 |
| `heartbeat` | 时间戳 | 保持连接 |
| `done` | `"[DONE]"` | 流结束 |

**Node.js 示例代码**
```javascript
import http from 'http';

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/v1/queue/join',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-key'
  }
};

const req = http.request(options, (res) => {
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const event = line.substring(7).trim();
        console.log('事件类型:', event);
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        console.log('数据:', data);
      }
    }
  });
});

req.write(JSON.stringify({
  messages: [{ role: "user", content: "a cute cat" }]
}));
req.end();
```

#### 带图片的请求

**支持格式**：PNG、JPEG、GIF、WebP  
**最大数量**：5 张图片  
**数据格式**：Base64 编码

**请求示例**
```json
{
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "make it more colorful"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
        }
      }
    ]
  }]
}
```

### 方式二：使用CLI客户端脚本

**启动CLI工具**
```bash
npm test
```
根据指引填写图片路径和提示词即可

---

## 📁 项目结构

```
lmarena/
├── server.js          # HTTP 服务器 (主入口)
├── config.yaml        # 配置文件
├── package.json       # 项目依赖
├── lib/
│   ├── lmarena.js     # 核心生图逻辑 (Puppeteer 操作)
│   ├── config.js      # 配置加载器
│   ├── genApiKey.js   # API 密钥生成工具
│   └── test.js        # 功能测试脚本
└── data/
    ├── chromeUserData/  # Chrome 用户数据 (自动创建)
    └── temp/            # 临时图片存储
```

---

## 🔧 常见问题

### 浏览器启动失败

**问题**: `Error: Failed to launch the browser process`

**解决方案**:
- 确保已安装 Chrome 或 Chromium
- 检查 `config.yaml` 中的 `chrome.path` 是否正确
- 尝试删除 `data/chromeUserData` 目录后重新运行

### GPU 相关错误

**问题**: 无显卡服务器运行时出现 GPU 错误

**解决方案**:
- 该报错并不会影响程序运行，但是强烈建议在无显卡的设备上关闭GPU加速
```yaml
chrome:
  gpu: false  # 禁用 GPU 加速
```

### 请求被拒绝 (429 Too Many Requests)

**问题**: 并发请求过多

**解决方案**:
- 该问题仅存在于OpenAI兼容模式
- 当前限制：1 个并发 + 2 个排队 (总计 3 个)
- 修改 `server.js` 中的 `MAX_CONCURRENT` 和 `MAX_QUEUE_SIZE` (不建议，应为大多数客户端HTTP请求是有超时时间的)
- 等待当前任务完成后再提交新任务

### reCAPTCHA 验证失败

**问题**: 返回 `recaptcha validation failed`

**解决方案**:
- 这是 LMArena 的人机验证机制
- 建议：
  - 降低请求频率
  - 首次使用时手动完成一次验证 (关闭 headless 模式)
  - 使用稳定和纯净的 IP 地址 (可使用 ping0.cc 查询IP地址纯净度)

### 图像生成超时

**问题**: 任务超过 120 秒未完成

**解决方案**:
- 检查网络连接是否稳定
- 某些复杂提示词可能需要更长时间

### Linux下关闭无头模式运行

**问题**: 在Linux多用户模式下无界面运行浏览器

**解决方案**:

方法一：X11转发（适用于后续无头模式运行）
- 推荐使用WindTerm开启右上角X-Server
- 在会话设置中的X11栏目中改为 “内部X11显示”

方法二：Xvfb+X11VNC（推荐）
- 使用xvfb创建虚拟显示器运行该程序，并且将虚拟显示器映射到VNC中便于后续管理（因为在后续使用中可能还会弹出reCAPTCHA验证码需要手动通过）
- 创建虚拟显示器并运行程序 (99为屏幕号，冲突可行更改)
```
xvfb-run --server-num=99 --server-args="-ac -screen 0 1280x720x16" npm start
```
- 将虚拟显示器映射至VNC
```
x11vnc -display :99 -localhost -nopw -once -noxdamage -ncache 10
```
- 后续可用RealVNC等程序通过5900端口连接（推荐使用SSH隧道转发不将VNC直接暴露在公网，然后VNC连接127.0.0.1）
```
ssh -L 5900:127.0.0.1:5900 root@服务器IP
```

---

## 📊 配置建议
| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 1核 | 2核及以上 |
| 内存 | 1GB | 2GB 及以上 |

参考：经测试可以在Oracle的1G1C免费机Debian环境下运行

## 📄 许可证

本项目仅供学习和研究使用，请遵守 LMArena.ai 的使用条款。

---

**感谢使用 LMArena 图像生成服务！** 🎉
