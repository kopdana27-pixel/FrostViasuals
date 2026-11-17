package dev.frostvisuals;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.KeyMapping;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import com.mojang.blaze3d.platform.InputConstants;
import org.lwjgl.glfw.GLFW;

public final class FrostClient implements ClientModInitializer {
    private static KeyMapping menu;
    private static boolean fps = true, coords = true, direction = true;
    private static boolean ping = true, moduleList = true;

    @Override
    public void onInitializeClient() {
        KeyMapping.Category category = KeyMapping.Category.register(
            Identifier.fromNamespaceAndPath("frostvisuals", "main")
        );
        menu = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.frostvisuals.menu", InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT, category
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (menu.consumeClick()) {
                if (client.player != null) client.setScreen(new FrostMenu());
            }
        });

        HudRenderCallback.EVENT.register((graphics, tickCounter) -> {
            Minecraft client = Minecraft.getInstance();
            if (client.player == null || client.level == null) return;

            int lines = (fps ? 1 : 0) + (coords ? 1 : 0) +
                        (direction ? 1 : 0) + (ping ? 1 : 0);
            int modules = moduleList ? 5 : 0;
            if (lines + modules == 0) return;

            graphics.fill(5, 5, 205, 12 + (lines + modules) * 14, 0x990D1522);
            graphics.fill(5, 5, 205, 7, 0xFF65D9FF);
            int y = 12;

            if (fps) {
                graphics.drawString(client.font,
                    Component.literal("FROST  |  FPS: " + client.getFps()),
                    10, y, 0xFF9DEBFF);
                y += 14;
            }
            if (ping) {
                var connection = client.getConnection();
                var info = connection == null ? null :
                    connection.getPlayerInfo(client.player.getUUID());
                String value = info == null ? "--" : info.getLatency() + " ms";
                graphics.drawString(client.font,
                    Component.literal("PING: " + value), 10, y, 0xFFB9C8FF);
                y += 14;
            }
            if (coords) {
                String xyz = String.format("XYZ: %.1f  %.1f  %.1f",
                    client.player.getX(), client.player.getY(), client.player.getZ());
                graphics.drawString(client.font, Component.literal(xyz),
                    10, y, 0xFFFFFFFF);
                y += 14;
            }
            if (direction) {
                graphics.drawString(client.font,
                    Component.literal("Yaw: " + Math.round(client.player.getYRot()) + "°"),
                    10, y, 0xFFB9C8FF);
                y += 14;
            }
            if (moduleList) {
                String[] names = {
                    "Frost HUD", "FPS Counter", "Coordinates",
                    "Direction", "Ping Display"
                };
                for (String name : names) {
                    graphics.drawString(client.font,
                        Component.literal("• " + name), 10, y, 0xFF65D9FF);
                    y += 14;
                }
            }
        });
    }

    public static class FrostMenu extends Screen {
        protected FrostMenu() { super(Component.literal("FROST VISUALS")); }

        private Component label(String name, boolean enabled) {
            return Component.literal(name + ": " + (enabled ? "ВКЛ" : "ВЫКЛ"));
        }

        @Override
        protected void init() {
            int x = width / 2 - 100;
            int y = height / 2 - 105;
            addRenderableWidget(Button.builder(label("FPS", fps), b -> {
                fps = !fps; b.setMessage(label("FPS", fps));
            }).bounds(x, y, 200, 22).build());
            addRenderableWidget(Button.builder(label("Ping", ping), b -> {
                ping = !ping; b.setMessage(label("Ping", ping));
            }).bounds(x, y + 27, 200, 22).build());
            addRenderableWidget(Button.builder(label("Координаты", coords), b -> {
                coords = !coords; b.setMessage(label("Координаты", coords));
            }).bounds(x, y + 54, 200, 22).build());
            addRenderableWidget(Button.builder(label("Направление", direction), b -> {
                direction = !direction; b.setMessage(label("Направление", direction));
            }).bounds(x, y + 81, 200, 22).build());
            addRenderableWidget(Button.builder(label("Module List", moduleList), b -> {
                moduleList = !moduleList; b.setMessage(label("Module List", moduleList));
            }).bounds(x, y + 108, 200, 22).build());
            addRenderableWidget(Button.builder(Component.literal("Закрыть"), b -> onClose())
                .bounds(x, y + 139, 200, 22).build());
        }

        @Override
        public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
            renderBackground(graphics, mouseX, mouseY, partialTick);
            graphics.fill(width / 2 - 125, height / 2 - 135,
                width / 2 + 125, height / 2 + 105, 0xEE101722);
            graphics.fill(width / 2 - 125, height / 2 - 135,
                width / 2 + 125, height / 2 - 132, 0xFF65D9FF);
            graphics.drawCenteredString(font, Component.literal("FROST VISUALS"),
                width / 2, height / 2 - 120, 0xFFBDEEFF);
            super.render(graphics, mouseX, mouseY, partialTick);
        }

        @Override
        public boolean isPauseScreen() { return false; }
    }
}
