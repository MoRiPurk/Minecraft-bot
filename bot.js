const mineflayer = require('mineflayer');
const cfg = require('./config');

// วนเช็ค bot.heldItem ทุกๆ 200ms จนกว่าจะเจอไอเทม หรือหมดเวลาที่กำหนด
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBot() {
  const bot = mineflayer.createBot({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    version: cfg.version,
  });

  bot.on('login', () => {
    console.log(`[${cfg.username}] เข้าสู่เซิร์ฟเวอร์แล้ว รอ spawn...`);
  });

  // ---- DEBUG: ดู packet ดิบทั้งหมดที่เกี่ยวกับ window/inventory ----
  // ลบส่วนนี้ออกได้เมื่อแก้ปัญหาเสร็จแล้ว
  bot._client.on('packet', (data, meta) => {
    if (meta.name.toLowerCase().includes('window') ||
        meta.name.toLowerCase().includes('container') ||
        meta.name.toLowerCase().includes('open_sign') ||
        meta.name === 'transaction') {
      console.log(`[DEBUG PACKET] ${meta.name}:`, JSON.stringify(data).slice(0, 300));
    }
  });

  bot.once('spawn', async () => {
    console.log(`[${cfg.username}] spawn สำเร็จ เริ่มขั้นตอนอัตโนมัติ`);

    try {
      await sleep(cfg.delayAfterSpawn);

      // ---- ขั้นตอนที่ 1: คลิกขวาไอเทมใน hotbar slot 1 (บังคับ) ----
      bot.setQuickBarSlot(1);

      // รอจนกว่าไอเทมใน slot จะโหลดเสร็จจริงๆ (แทนการ sleep นิ่งๆ)
      const heldItem = await waitForHeldItem(bot, 10000); // รอสูงสุด 10 วิ

      if (heldItem) {
        this._log(username, `คลิกขวาไอเทม: ${heldItem.name}`);
      } else {
        this._log(username, `ไม่พบไอเทมใน slot 1 หลังรอจนหมดเวลา`);
      }

      // เปิดหน้าต่าง GUI ด้วยการคลิกขวา แล้วรอ event windowOpen
      const windowOpenPromise = new Promise((resolve) => {
        bot.once('windowOpen', (window) => resolve(window));
      });
      bot.on("windowOpen", (window) => {
    console.log("=== WINDOW OPEN ===");
    console.log("Title:", window.title);
    console.log("Slots:", window.slots.length);
});

bot.on("windowClose", () => {
    console.log("=== WINDOW CLOSE ===");
});

      bot.activateItem(); // เทียบเท่าการคลิกขวา
      bot.on("windowOpen", (window) => {
      console.log("windowOpen Event");
      console.log(window.title);
      });

      bot.on("windowClose", () => {
        console.log("windowClose Event");
      });
      bot.on("message", (msg) => {
        console.log(msg.toAnsi());
      });
      // รอหน้าต่างเปิด (timeout กันค้าง)
      const window = await Promise.race([
        windowOpenPromise,
        sleep(cfg.windowOpenTimeout).then(() => null),
      ]);

      if (!window) {
        console.log(`[${cfg.username}] ไม่มีหน้าต่าง GUI เปิดขึ้นมาหลังคลิกขวา (timeout)`);
      } else {
        console.log(`[${cfg.username}] เปิดหน้าต่าง: "${window.title || '(ไม่มีชื่อ)'}" (slots: ${window.slots.length})`);

        await sleep(cfg.delayBeforeMenuClick);

        // ---- ขั้นตอนที่ 2: หาไอเทมแรก (บนสุด) ในหน้าต่างแล้วคลิก ----
        // สแกนจาก slot 0 ไปเรื่อยๆ เฉพาะส่วนของ "หน้าต่างเมนู" (ไม่รวม inventory ผู้เล่นด้านล่าง)
      // รอให้ไอเท็มโหลด
      await sleep(1000);

      // แสดงตำแหน่งไอเท็มทั้งหมด (ใช้เช็กครั้งแรก)
      for (let i = 0; i < window.inventoryStart; i++) {
      if (window.slots[i]) {
          console.log(`Slot ${i}: ${window.slots[i].name}`);
      }
    }

// คลิกช่องที่ต้องการ
      try {
          await bot.clickWindow(10, 0, 0);
          console.log("คลิกเซิร์ฟเวอร์เรียบร้อย");
      } catch (err) {
          console.log("คลิกไม่สำเร็จ:", err.message);
      }
      }
      console.log("inventoryStart =", window.inventoryStart);
      console.log("slots =", window.slots.length);

      // ---- ขั้นตอนที่ 3: รอ 8 วินาที แล้วพิมพ์ /afk ----
      await sleep(cfg.delayBeforeAfk);
      bot.chat('/afk');
      console.log(`[${cfg.username}] พิมพ์ /afk เรียบร้อย`);

    } catch (err) {
      console.error(`[${cfg.username}] เกิดข้อผิดพลาดระหว่างขั้นตอนอัตโนมัติ:`, err);
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`[${cfg.username}] ถูกเตะออกจากเซิร์ฟเวอร์:`, reason);
  });

  bot.on('error', (err) => {
    console.error(`[${cfg.username}] เกิดข้อผิดพลาด:`, err);
  });

  bot.on('end', () => {
    console.log(`[${cfg.username}] การเชื่อมต่อสิ้นสุดลง`);
  });

  return bot;
}

createBot();