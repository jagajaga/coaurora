// Coaurora settings — sliders stored in SharedPreferences; the wallpaper
// engine listens and applies changes live. Built programmatically (no layout
// XML, no dependencies).

package me.jagajaga.coaurora

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView

class SettingsActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = Prefs.get(this)
        val dp = resources.displayMetrics.density

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0c0d0b"))
            setPadding((20 * dp).toInt(), (24 * dp).toInt(), (20 * dp).toInt(), (24 * dp).toInt())
        }

        col.addView(TextView(this).apply {
            text = "coaurora"
            textSize = 28f
            setTextColor(Color.parseColor("#3DDC7C"))
        })
        col.addView(TextView(this).apply {
            text = "a Store-comonad aurora · settings apply live"
            textSize = 13f
            setTextColor(Color.parseColor("#8c8f80"))
            setPadding(0, 0, 0, (16 * dp).toInt())
        })

        fun slider(label: String, key: String, min: Int, max: Int, def: Int, show: (Int) -> String) {
            val title = TextView(this).apply {
                textSize = 14f
                setTextColor(Color.parseColor("#cdd8c4"))
            }
            fun refresh(v: Int) { title.text = "$label   ${show(v)}" }
            refresh(p.getInt(key, def))
            val bar = SeekBar(this).apply {
                this.max = max - min
                progress = p.getInt(key, def) - min
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(s: SeekBar?, value: Int, fromUser: Boolean) {
                        val v = value + min
                        p.edit().putInt(key, v).apply()   // engine listens; applies live
                        refresh(v)
                    }
                    override fun onStartTrackingTouch(s: SeekBar?) {}
                    override fun onStopTrackingTouch(s: SeekBar?) {}
                })
            }
            col.addView(title)
            col.addView(bar, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = (12 * dp).toInt() })
        }

        slider("speed",     "speed",     0,  300, 100) { "${it / 100f}×" }
        slider("tilt",      "tilt",      0,  90,  67)  { "${it - 45}°" }
        slider("thickness", "thickness", 20, 160, 60)  { "${it / 100f}" }
        slider("brightness","brightness",0,  250, 100) { "${it / 100f}×" }
        slider("hue low",   "hueLo",     0,  360, 85)  { "$it°" }
        slider("hue high",  "hueHi",     0,  360, 165) { "$it°" }
        slider("curtains",  "curtains",  3,  28,  16)  { "$it" }
        slider("fps",       "fps",       0,  2,   1)   { intArrayOf(15, 30, 60)[it].toString() }

        col.addView(Button(this).apply {
            text = "Set as wallpaper (home / lock)"
            setOnClickListener {
                startActivity(Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                    putExtra(
                        WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                        ComponentName(this@SettingsActivity, CoauroraWallpaperService::class.java)
                    )
                })
            }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = (16 * dp).toInt() })

        col.addView(TextView(this).apply {
            text = "After tapping Apply, Samsung asks where to put it — pick “Lock screen” or “Home and lock screens”."
            textSize = 12f
            setTextColor(Color.parseColor("#8c8f80"))
            gravity = Gravity.CENTER
            setPadding(0, (10 * dp).toInt(), 0, 0)
        })

        setContentView(ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#0c0d0b"))
            addView(col)
        })
    }
}
