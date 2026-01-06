/**
 * 下载库文件脚本
 * 运行方式：node download-libs.js
 * 
 * 此脚本会下载 mammoth.js 和 pdfjs 到 libs 目录
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LIB_DIR = path.join(__dirname, 'libs');

// 确保 libs 目录存在
if (!fs.existsSync(LIB_DIR)) {
    fs.mkdirSync(LIB_DIR, { recursive: true });
    console.log('✅ 创建 libs 目录');
}

// 下载文件的函数
function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(filepath);
        
        console.log(`📥 开始下载: ${url}`);
        
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // 处理重定向
                return downloadFile(response.headers.location, filepath)
                    .then(resolve)
                    .catch(reject);
            }
            
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filepath);
                reject(new Error(`下载失败: HTTP ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✅ 下载完成: ${path.basename(filepath)}`);
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
            reject(err);
        });
    });
}

// 要下载的文件列表
const filesToDownload = [
    {
        url: 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
        filename: 'mammoth.browser.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        filename: 'pdf.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
        filename: 'pdf.worker.min.js'
    }
];

// 下载所有文件
async function downloadAll() {
    console.log('🚀 开始下载库文件...\n');
    
    for (const file of filesToDownload) {
        const filepath = path.join(LIB_DIR, file.filename);
        
        try {
            await downloadFile(file.url, filepath);
        } catch (error) {
            console.error(`❌ 下载失败 ${file.filename}:`, error.message);
            // 尝试备用 CDN
            const backupUrls = [
                'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
                'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
                'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
            ];
            
            const backupIndex = filesToDownload.indexOf(file);
            if (backupUrls[backupIndex]) {
                console.log(`🔄 尝试备用 CDN: ${backupUrls[backupIndex]}`);
                try {
                    await downloadFile(backupUrls[backupIndex], filepath);
                } catch (backupError) {
                    console.error(`❌ 备用 CDN 也失败:`, backupError.message);
                    throw new Error(`无法下载 ${file.filename}`);
                }
            } else {
                throw error;
            }
        }
    }
    
    console.log('\n✅ 所有库文件下载完成！');
    console.log(`📁 文件位置: ${LIB_DIR}`);
}

// 运行
downloadAll().catch(error => {
    console.error('\n❌ 下载过程出错:', error);
    process.exit(1);
});
