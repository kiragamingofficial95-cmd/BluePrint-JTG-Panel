import express from "express";

const router = express.Router();

// Public / Authenticated extension endpoint
router.get("/status", (req, res) => {
  res.json({
    status: "online",
    extensionId: "hello-jtg",
    name: "Hello JTG Extension",
    version: "1.0.0",
    serverTime: new Date().toISOString(),
    features: ["lifecycle_hooks", "database_scoped", "dynamic_routing", "config_schema"],
  });
});

router.get("/greet", (req, res) => {
  res.json({
    message: "Greetings from Hello JTG Extension running securely inside JTG Blueprint!",
    timestamp: Date.now(),
  });
});

export const extension = {
  async install(context) {
    context.logger.info("Hello JTG: Running install lifecycle hook...");
    // Seed initial greeting record in scoped db
    await context.db.set("greetings", "default", {
      title: "Welcome to Blueprint",
      text: context.getConfig("greetingMessage", "Hello from JTG Blueprint!"),
      views: 0,
    });
    context.logger.info("Hello JTG: Installation complete.");
  },

  async enable(context) {
    context.logger.info("Hello JTG: Extension enabled.");
  },

  async disable(context) {
    context.logger.info("Hello JTG: Extension disabled.");
  },

  async update(fromVersion, toVersion, context) {
    context.logger.info(`Hello JTG: Updating from ${fromVersion} to ${toVersion}...`);
  },

  async uninstall(context, purgeData) {
    context.logger.info(`Hello JTG: Uninstalling extension (purgeData: ${purgeData}).`);
    if (purgeData) {
      await context.db.remove("greetings", "default");
    }
  },
};

export { router };
export default extension;
