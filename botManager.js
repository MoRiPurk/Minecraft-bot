const mineflayer = require('mineflayer');
const EventEmitter = require('events');
const cfg = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// วนเช็ค bot.heldItem ทุกๆ intervalMs จนกว่าจะเจอไอเทม หรือหมดเวลาที่กำหนด
function waitForHeldItem(bot, timeoutMs = 10000, intervalMs = 200) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      if (bot.heldItem) {
        resolve(bot.heldItem);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null); // หมดเวลาแล้วยังไม่เจอ
        return;
      }
      setTimeout(check, intervalMs);
    };

    check();
  });
}

class BotManager extends EventEmitter {
  constructor() {
    super();
    this.bots = new Map(); // username -> { bot, state, logs }
  }

  _updateState(username, patch) {
    const entry = this.bots.get(username);
    if (!entry) return;
    entry.state = { ...entry.state, ...patch, updatedAt: Date.now() };
    this.emit('update', username, entry.state);
  }

  _log(username, message) {
    const entry = this.bots.get(username);
    if (!entry) return;
    const line = { time: Date.now(), message };
    entry.logs.push(line);
    if (entry.logs.length > 200) entry.logs.shift();
    this.emit('log', username, line);
  }

  getAllStatus() {
    const result = {};
    for (const [username, entry] of this.bots.entries()) {
      result[username] = { ...entry.state, logs: entry.logs.slice(-50) };
    }
    return result;
  }

  getStatus(username) {
    const entry = this.bots.get(username);
    if (!entry) return null;
    return { ...entry.state, logs: entry.logs.slice(-50) };
  }

  connectBot(username) {
    const existing = this.bots.get(username);
    if (existing && existing.state.connected) return false;

    const state = {
      username,
      connected: false,
      status: 'connecting',
      updatedAt: Date.now(),
    };
    const logs = existing ? existing.logs : [];
    this.bots.set(username, { bot: null, state, logs });
    this._updateState(username, state);
    this._log(username, 'กำลังเชื่อมต่อ...');

    const bot = mineflayer.createBot({
      host: cfg.server.host,
      port: cfg.server.port,
      username,
      version: cfg.server.version,
    });

    this.bots.get(username).bot = bot;

    bot.on('login', () => {
      this._updateState(username, { connected: true, status: 'logged-in' });
      this._log(username, 'เข้าสู่เซิร์ฟเวอร์แล้ว รอ spawn...');
    });

    bot.once('spawn', async () => {
      this._updateState(username, { status: 'spawned' });
      this._log(username, 'spawn สำเร็จ เริ่มขั้นตอนอัตโนมัติ');

      try {
        await sleep(cfg.delayAfterSpawn);

        this._updateState(username, { status: 'right-clicking' });
        bot.setQuickBarSlot(1);

        // รอจนกว่าไอเทมใน slot จะโหลดเสร็จจริงๆ (แทนการ sleep นิ่งๆ)
        const heldItem = await waitForHeldItem(bot, 10000);

        if (heldItem) {
          this._log(username, `คลิกขวาไอเทม: ${heldItem.name}`);
        } else {
          this._log(username, 'ไม่พบไอเทมใน slot 1 หลังรอจนหมดเวลา');
        }

        const windowOpenPromise = new Promise((resolve) => {
          bot.once('windowOpen', (window) => resolve(window));
        });

        bot.activateItem();

        this._updateState(username, { status: 'waiting-window' });
        const window = await Promise.race([
          windowOpenPromise,
          sleep(cfg.windowOpenTimeout).then(() => null),
        ]);

        if (!window) {
          this._log(username, 'ไม่มีหน้าต่าง GUI เปิดขึ้นมาหลังคลิกขวา (timeout)');
        } else {
          this._log(username, `เปิดหน้าต่าง: "${window.title || '(ไม่มีชื่อ)'}" (slots: ${window.slots.length})`);
          this._updateState(username, { status: 'window-open' });

          await sleep(cfg.delayBeforeMenuClick);
          await sleep(1000);

          try {
            await bot.clickWindow(10, 0, 0);
            this._log(username, 'คลิกเมนูเรียบร้อย');
            this._updateState(username, { status: 'clicked' });
          } catch (err) {
            this._log(username, `คลิกไม่สำเร็จ: ${err.message}`);
          }
        }

        this._updateState(username, { status: 'waiting-respawn' });
        this._log(username, 'รอ respawn หลังคลิกไอเทม...');

        const respawnPromise = new Promise((resolve) => {
          bot.once('respawn', () => resolve(true));
        });

        const respawned = await Promise.race([
          respawnPromise,
          sleep(cfg.respawnTimeout ?? 15000).then(() => false),
        ]);

        if (respawned) {
          this._log(username, 'ตรวจพบ respawn แล้ว');
        } else {
          this._log(username, 'ไม่พบ respawn ภายในเวลาที่กำหนด (timeout) จะพิมพ์ /afk ต่อไป');
        }

        await sleep(cfg.delayAfterRespawn ?? 2000);

        bot.chat('/afk');
        this._log(username, 'พิมพ์ /afk เรียบร้อย');
        this._updateState(username, { status: 'afk' });

      } catch (err) {
        this._log(username, `เกิดข้อผิดพลาดระหว่างขั้นตอนอัตโนมัติ: ${err.message}`);
        this._updateState(username, { status: 'error' });
      }
    });

    bot.on('kicked', (reason) => {
      const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      this._log(username, `ถูกเตะออกจากเซิร์ฟเวอร์: ${reasonText}`);
      this._updateState(username, { connected: false, status: 'kicked' });
    });

    bot.on('error', (err) => {
      this._log(username, `เกิดข้อผิดพลาด: ${err.message}`);
      this._updateState(username, { status: 'error' });
    });

    bot.on('end', () => {
      this._log(username, 'การเชื่อมต่อสิ้นสุดลง');
      this._updateState(username, { connected: false, status: 'disconnected' });
    });

    // แจ้งข้อความแชท ยกเว้นข้อความที่มีคำว่า "Crate"
    bot.on('message', (msg) => {
      const text = msg.toString();
      if (text.includes('Crate')) return;
      this._log(username, text);
    });

    return true;
  }

  disconnectBot(username) {
    const entry = this.bots.get(username);
    if (!entry || !entry.bot) return false;
    entry.bot.quit();
    this._updateState(username, { connected: false, status: 'disconnected' });
    this._log(username, 'ถูกตัดการเชื่อมต่อโดยผู้ใช้');
    return true;
  }

  reconnectBot(username) {
    const entry = this.bots.get(username);
    if (entry && entry.bot) {
      try { entry.bot.quit(); } catch (e) { /* ignore */ }
    }
    this._log(username, 'กำลังเชื่อมต่อใหม่...');
    setTimeout(() => this.connectBot(username), 1000);
    return true;
  }

  addBot(username) {
    if (this.bots.has(username)) return false;
    this.connectBot(username);
    return true;
  }
}

module.exports = new BotManager();
