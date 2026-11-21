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

// 3. Đảm bảo app/build.gradle có thư viện OkHttp cho WebSocket Edge TTS & HTTP fallback
const buildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  if (!gradle.includes('com.squareup.okhttp3:okhttp')) {
    gradle = gradle.replace(
      /^dependencies\s*\{/m,
      `dependencies {\n    implementation "com.squareup.okhttp3:okhttp:4.12.0"`
    );
    fs.writeFileSync(buildGradlePath, gradle, 'utf8');
    console.log('✓ Đã thêm dependency OkHttp 4.12.0 vào android/app/build.gradle');
  }
}

// 4. Đảm bảo quyền INTERNET, RECORD_AUDIO, CAMERA, MODIFY_AUDIO_SETTINGS
//    VÀ khai báo <queries> cho RecognitionService + TTS (BẮT BUỘC trên Android 11-15 / API 30-35!)
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
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

  // Android 11+ (API 30-35) yêu cầu khai báo <queries> thì SpeechRecognizer & TextToSpeech mới nhìn thấy service hệ thống!
  if (!manifest.includes('android.speech.RecognitionService')) {
    const queriesBlock = `    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>\n    <application`;
    manifest = manifest.replace('<application', queriesBlock);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('✓ Đã bổ sung quyền & <queries> RecognitionService/TTS_SERVICE vào AndroidManifest.xml');
  }
}
