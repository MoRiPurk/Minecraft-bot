module.exports = {
  server: {
    host: 'play.amorycraft.com',
    port: 25565,
    version: '1.21.11',
  },

  // รายชื่อบอทที่จะเชื่อมต่ออัตโนมัติเมื่อรันโปรแกรม
  bots: [
    
  ],

  hotbarSlotToRightClick: 0,   // slot hotbar ที่จะคลิกขวา (0-8)
  delayAfterSpawn: 3000,       // ms รอหลัง spawn ก่อนเริ่มคลิกขวา
  windowOpenTimeout: 5000,     // ms รอหน้าต่าง GUI เปิด
  delayBeforeMenuClick: 500,   // ms รอก่อนคลิกเมนู
  respawnTimeout: 15000,       // ms รอ respawn สูงสุด ก่อนพิมพ์ /afk ไปเลย
  delayAfterRespawn: 2000,     // ms รอเพิ่มหลัง respawn ก่อนพิมพ์ /afk

  webPort: 3000,               // พอร์ตของหน้าเว็บ dashboard
};