// Karma config ของ ng test — เหมือนค่าเริ่มต้นของ Angular CLI ทุกอย่าง ยกเว้น customHeaders ด้านล่าง
//
// Content-Security-Policy ของหน้าเทสต์: โหลดรูป/เรียก HTTP ได้เฉพาะจาก Karma เอง (+ localhost)
// -> ถ้าโค้ดไหนเผลอโหลดรูปหรือข้อมูลจากเว็บภายนอก browser จะบล็อกก่อนออกไปถึงเน็ต
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        // ng test --code-coverage -> coverage/frontend/lcov.info ให้ SonarQube
        // projectRoot = root ของ repo: path ในไฟล์เป็น "frontend/src/..." ใช้ได้ทั้งบนเครื่องและใน Docker ของ scanner
        { type: 'lcovonly', file: 'lcov.info', projectRoot: require('path').join(__dirname, '..') }
      ]
    },
    customHeaders: [
      {
        match: '.*\\.html',
        name: 'Content-Security-Policy',
        value: "img-src 'self' data: blob:; connect-src 'self' ws: wss: http://localhost:*"
      }
    ],
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    // CI (.github/workflows/ci.yml): ng test --watch=false --browsers=ChromeHeadlessCI
    // runner Ubuntu 24.04 จำกัด user namespace -> sandbox ของ Chrome เปิดไม่ได้ จึงปิด sandbox (เปิดแค่หน้าเทสต์ของ Karma เอง)
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-dev-shm-usage']
      }
    },
    restartOnFileChange: true
  });
};
