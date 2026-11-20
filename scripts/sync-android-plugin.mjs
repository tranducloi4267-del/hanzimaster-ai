import fs from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve('android');
if (!fs.existsSync(androidRoot)) {
  console.log('ℹ Chưa có thư mục android/. Chạy "npx cap add android" trước khi sync plugin native.');
  process.exit(0);
}

const pkgDir = path.join(androidRoot, 'app', 'src', 'main', 'java', 'com', 'hanzimaster', 'ai');
fs.mkdirSync(pkgDir, { recursive: true });

// 1. Copy EdgeTtsPlugin.java
const srcPlugin = path.resolve('android-plugin/EdgeTtsPlugin.java');
const dstPlugin = path.join(pkgDir, 'EdgeTtsPlugin.java');
fs.copyFileSync(srcPlugin, dstPlugin);
console.log('✓ Đã chép EdgeTtsPlugin.java vào dự án Android');

// 2. Đảm bảo MainActivity đăng ký EdgeTtsPlugin
const mainActivityPath = path.join(pkgDir, 'MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  let content = fs.readFileSync(mainActivityPath, 'utf8');
  if (!content.includes('EdgeTtsPlugin.class')) {
    const replacement = `package com.hanzimaster.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EdgeTtsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
    fs.writeFileSync(mainActivityPath, replacement, 'utf8');
    console.log('✓ Đã đăng ký EdgeTtsPlugin trong MainActivity.java');
  }
}

// 3. Đảm bảo app/build.gradle có thư viện OkHttp cho WebSocket Edge TTS
const buildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  if (!gradle.includes('com.squareup.okhttp3:okhttp')) {
    gradle = gradle.replace(
      /dependencies\s*\{/,
      `dependencies {\n    implementation "com.squareup.okhttp3:okhttp:4.12.0"`
    );
    fs.writeFileSync(buildGradlePath, gradle, 'utf8');
    console.log('✓ Đã thêm dependency OkHttp 4.12.0 vào android/app/build.gradle');
  }
}

// 4. Đảm bảo quyền INTERNET & RECORD_AUDIO & CAMERA trong AndroidManifest.xml
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const perms = [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO',
    'android.permission.CAMERA'
  ];
  let modified = false;
  for (const p of perms) {
    if (!manifest.includes(p)) {
      manifest = manifest.replace(
        '<application',
        `    <uses-permission android:name="${p}" />\n    <application`
      );
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('✓ Đã bổ sung quyền INTERNET/RECORD_AUDIO/CAMERA vào AndroidManifest.xml');
  }
}
