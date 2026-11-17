package dev.frostvisuals;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public final class FrostClient implements ClientModInitializer {
    private static KeyBinding menu;
    private static boolean fps = true, coords = true, direction = true;
    private static boolean ping = true, moduleList = true;

    @Override
    public void onInitializeClient() {
        menu = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.frostvisuals.menu", InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT, "category.frostvisuals"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (menu.wasPressed()) {
                if (client.player != null) client.setScreen(new FrostMenu());
            }
        });

        HudRenderCallback.EVENT.register((context, tickCounter) -> {
            MinecraftClient client = MinecraftClient.getInstance();
            if (client.player == null || client.world == null) return;

            int lines = (fps ? 1 : 0) + (coords ? 1 : 0) +
                        (direction ? 1 : 0) + (ping ? 1 : 0);
            int modules = moduleList ? 5 : 0;
            if (lines + modules == 0) return;

            context.fill(5, 5, 205, 12 + (lines + modules) * 14, 0x990D1522);
            context.fill(5, 5, 205, 7, 0xFF65D9FF);
            int y = 12;

            if (fps) {
                context.drawTextWithShadow(client.textRenderer,
                    Text.literal("FROST  |  FPS: " + client.getCurrentFps()),
                    10, y, 0xFF9DEBFF);
                y += 14;
            }
            if (ping) {
                var entry = client.getNetworkHandler() == null ? null :
                    client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
                String value = entry == null ? "--" : entry.getLatency() + " ms";
                context.drawTextWithShadow(client.textRenderer,
                    Text.literal("PING: " + value), 10, y, 0xFFB9C8FF);
                y += 14;
            }
            if (coords) {
                String xyz = String.format("XYZ: %.1f  %.1f  %.1f",
                    client.player.getX(), client.player.getY(), client.player.getZ());
                context.drawTextWithShadow(client.textRenderer,
                    Text.literal(xyz), 10, y, 0xFFFFFFFF);
                y += 14;
            }
            if (direction) {
                context.drawTextWithShadow(client.textRenderer,
                    Text.literal("Yaw: " + Math.round(client.player.getYaw()) + "°"),
                    10, y, 0xFFB9C8FF);
                y += 14;
            }
            if (moduleList) {
                String[] names = {
                    "Frost HUD", "FPS Counter", "Coordinates",
                    "Direction", "Ping Display"
                };
                for (String name : names) {
                    context.drawTextWithShadow(client.textRenderer,
                        Text.literal("• " + name), 10, y, 0xFF65D9FF);
                    y += 14;
                }
            }
        });
    }

    public static class FrostMenu extends Screen {
        protected FrostMenu() { super(Text.literal("FROST VISUALS")); }

        private Text label(String name, boolean enabled) {
            return Text.literal(name + ": " + (enabled ? "ВКЛ" : "ВЫКЛ"));
        }

        @Override
        protected void init() {
            int x = width / 2 - 100;
            int y = height / 2 - 105;
            addDrawableChild(ButtonWidget.builder(label("FPS", fps), b -> {
                fps = !fps; b.setMessage(label("FPS", fps));
            }).dimensions(x, y, 200, 22).build());
            addDrawableChild(ButtonWidget.builder(label("Ping", ping), b -> {
                ping = !ping; b.setMessage(label("Ping", ping));
            }).dimensions(x, y + 27, 200, 22).build());
            addDrawableChild(ButtonWidget.builder(label("Координаты", coords), b -> {
                coords = !coords; b.setMessage(label("Координаты", coords));
            }).dimensions(x, y + 54, 200, 22).build());
            addDrawableChild(ButtonWidget.builder(label("Направление", direction), b -> {
                direction = !direction; b.setMessage(label("Направление", direction));
            }).dimensions(x, y + 81, 200, 22).build());
            addDrawableChild(ButtonWidget.builder(label("Module List", moduleList), b -> {
                moduleList = !moduleList; b.setMessage(label("Module List", moduleList));
            }).dimensions(x, y + 108, 200, 22).build());
            addDrawableChild(ButtonWidget.builder(Text.literal("Закрыть"), b -> close())
                .dimensions(x, y + 139, 200, 22).build());
        }

        @Override
        public void render(DrawContext context, int mouseX, int mouseY, float delta) {
            renderBackground(context, mouseX, mouseY, delta);
            context.fill(width / 2 - 125, height / 2 - 135,
                width / 2 + 125, height / 2 + 105, 0xEE101722);
            context.fill(width / 2 - 125, height / 2 - 135,
                width / 2 + 125, height / 2 - 132, 0xFF65D9FF);
            context.drawCenteredTextWithShadow(textRenderer,
                Text.literal("FROST VISUALS"), width / 2, height / 2 - 120, 0xFFBDEEFF);
            super.render(context, mouseX, mouseY, delta);
        }

        @Override
        public boolean shouldPause() { return false; }
    }
}
