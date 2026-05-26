'use strict';

// SSH/GIT_ASKPASS 回调：从环境变量读取 passphrase 并输出到 stdout
process.stdout.write(process.env.DEEPSEEK_ASKPASS_SECRET || '');
