package com.designclio.readingplatform;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBarAppearance")
public class SystemBarAppearancePlugin extends Plugin {
    private final ArgbEvaluator argbEvaluator = new ArgbEvaluator();
    private ValueAnimator colorAnimator;

    @PluginMethod
    public void setColor(PluginCall call) {
        String colorValue = call.getString("color");
        if (colorValue == null || !colorValue.matches("#[0-9a-fA-F]{6}")) {
            call.reject("A six-digit hexadecimal system bar color is required.");
            return;
        }

        final int color = Color.parseColor(colorValue);
        getBridge().executeOnMainThread(() -> {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing()) {
                call.reject("The Android activity is not available.");
                return;
            }

            Window window = activity.getWindow();
            View decorView = window.getDecorView();
            WebView webView = getBridge().getWebView();
            boolean darkIcons = calculateLuminance(color) > 0.179;

            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, decorView);
            controller.setAppearanceLightStatusBars(darkIcons);
            controller.setAppearanceLightNavigationBars(darkIcons);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }

            if (colorAnimator != null) {
                colorAnimator.cancel();
            }

            int startColor = decorView.getSolidColor();
            if (startColor == Color.TRANSPARENT) {
                startColor = webView.getSolidColor();
            }
            if (startColor == Color.TRANSPARENT) {
                startColor = color;
            }
            final int initialColor = startColor;

            colorAnimator = ValueAnimator.ofFloat(0f, 1f);
            colorAnimator.setDuration(180);
            colorAnimator.addUpdateListener(animator -> {
                float fraction = (float) animator.getAnimatedValue();
                int animatedColor = (int) argbEvaluator.evaluate(fraction, initialColor, color);

                decorView.setBackgroundColor(animatedColor);
                webView.setBackgroundColor(animatedColor);
                if (Build.VERSION.SDK_INT >= 35) {
                    window.setStatusBarColor(Color.TRANSPARENT);
                    window.setNavigationBarColor(Color.TRANSPARENT);
                } else {
                    window.setStatusBarColor(animatedColor);
                    window.setNavigationBarColor(animatedColor);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    window.setNavigationBarDividerColor(animatedColor);
                }
            });
            colorAnimator.start();
            call.resolve();
        });
    }

    private double calculateLuminance(int color) {
        double red = linearize(Color.red(color) / 255.0);
        double green = linearize(Color.green(color) / 255.0);
        double blue = linearize(Color.blue(color) / 255.0);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }

    private double linearize(double channel) {
        return channel <= 0.04045
                ? channel / 12.92
                : Math.pow((channel + 0.055) / 1.055, 2.4);
    }
}
