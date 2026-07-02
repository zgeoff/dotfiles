-- TODO(#3): clean up and finish baseline customization of awesome wm config

-- core
local gears = require('gears')
local awful = require('awful')

-- 3rd party plugins
local lain = require('lain')

-- widget & layout
local wibox = require('wibox')

-- theming
local beautiful = require('beautiful')

-- notifications
local naughty = require('naughty')
local hotkeys_popup = require('awful.hotkeys_popup').widget

-- plugins
require('awful.autofocus')

-- enable vim help for our popup widget
-- require('awful.hotkeys_popup.keys.vim')

-- send a notification if we encountered issues during startup
if awesome.startup_errors then
  naughty.notify({
    preset = naughty.config.presets.critical,
    title = 'there was an error during startup',
    text = awesome.startup_errors,
  })
end

-- handle runtime errors after startup
do
  local in_error = false
  awesome.connect_signal('debug::error', function(err)
    -- avoid endless error handling loop
    if in_error then return end

    in_error = true

    naughty.notify({
      preset = naughty.config.presets.critical,
      title = 'Oops, an error happened!',
      text = tostring(err),
    })

    in_error = false
  end)
end

-- theme
theme = gears.filesystem.get_configuration_dir() .. 'theme.lua'
beautiful.init(theme)

-- utils
browser = os.getenv('BROWSER')
gui_editor = os.getenv('VISUAL')
editor = os.getenv('EDITOR')
terminal = os.getenv('TERMINAL')

-- core config
modkey = 'Mod4'

-- awful.layout.layouts = {
  -- awful.layout.suit.tile,
  -- awful.layout.suit.floating,
  -- awful.layout.suit.tile.left,
  -- awful.layout.suit.tile.bottom,
  -- awful.layout.suit.tile.top,
  -- awful.layout.suit.fair,
  -- awful.layout.suit.fair.horizontal,
  -- awful.layout.suit.spiral,
  -- awful.layout.suit.spiral.dwindle,
  -- awful.layout.suit.max,
  -- awful.layout.suit.max.fullscreen,
  -- awful.layout.suit.magnifier,
  -- awful.layout.suit.corner.nw,
  -- awful.layout.suit.corner.ne,
  -- awful.layout.suit.corner.sw,
  -- awful.layout.suit.corner.se,
-- }

-- {{{ Wibar

darkblue = beautiful.bg_focus
blue = '#9EBABA'
red = '#EB8F8F'
separator = wibox.widget.textbox(' <span color="' .. blue .. '">| </span>')
spacer = wibox.widget.textbox(' <span color="' .. blue .. '"> </span>')

-- simple text-based clock widget
widget_clock = wibox.widget.textclock(' %a %b %d - %H:%M ')

-- create a wi(dget)box for each screen and add it
local taglist_buttons = gears.table.join(
  awful.button({}, 1, function(t)
    t:view_only()
  end)
)

local tasklist_buttons = gears.table.join(
  -- minimize / unminimize and focus the client on left click
  awful.button({}, 1, function(c)
    if c == client.focus then
      c.minimized = true
    else
      c.minimized = false

      if not c:isvisible() and c.first_tag then
        c.first_tag:view_only()
      end

      client.focus = c
      c:raise()
    end
  end)
)

-- configure the wallpaper
local function set_wallpaper(s)
  gears.wallpaper.fit(beautiful.background_image, s, beautiful.background_color)
end

-- reset the wallpaper when a screen's geometry changes (e.g. different resolution)
screen.connect_signal('property::geometry', set_wallpaper)

awful.screen.connect_for_each_screen(function(s)

  -- set the wallpaper
  set_wallpaper(s)

  -- populate the tag table
  awful.tag.add('Main', {
    -- master_fill_policy = 'master_width_factor',
    layout = awful.layout.suit.tile,
    screen = s,
    selected = true,
  })

  awful.tag.add('Browse', {
    -- master_fill_policy = 'master_width_factor',
    layout = lain.layout.centerwork,
    screen = s,
  })

  awful.tag.add('Dev', {
    -- master_fill_policy = 'master_width_factor',
    layout = lain.layout.centerwork,
    screen = s,
  })

  awful.tag.add('Vidya', {
    -- master_fill_policy = 'master_width_factor',
    layout = awful.layout.suit.floating,
    screen = s,
  })

  awful.tag.add('League', {
    layout = awful.layout.suit.max.fullscreen,
    screen = s,
  })

  -- taglist widget
  s.mytaglist =
    awful.widget.taglist(s, awful.widget.taglist.filter.all, taglist_buttons)

  -- tasklist widget
  s.mytasklist =
    awful.widget.tasklist(
      s,
      awful.widget.tasklist.filter.currenttags,
      tasklist_buttons
    )

  -- create the wibox
  s.mywibox = awful.wibar({
    position = 'top',
    screen = s,
  })

  -- add widgets to the wibox -- Left widgets -- Middle widget -- Right widgets
  s.mywibox:setup {
    layout = wibox.layout.align.horizontal,
    {
      layout = wibox.layout.fixed.horizontal,
      mylauncher,
      s.mytaglist,
      separator,
    },
    s.mytasklist,
    {
      layout = wibox.layout.fixed.horizontal,
      wibox.widget.systray(),
      separator,
      widget_clock,
    },
  }
end)

-- }}}

-- screenshot helper functions
local function captureScreenshot(opts)
  opts = opts or ""

  awful.spawn.with_shell('maim ' .. opts .. ' ~/screenshots/$(date +%Y%m%d_%H%M%S_%N).png')
end

local function captureScreenshotSelection()
  captureScreenshot('--select')
end

local function captureScreenshotActiveWindow()
  captureScreenshot('--window=$(xdotool getactivewindow)')
end

-- {{{ Key bindings
globalkeys = gears.table.join(
  awful.key({ modkey }, 's', hotkeys_popup.show_help, {
    description = 'show help',
    group = 'awesome',
  }),
  awful.key({ modkey }, 'Left', awful.tag.viewprev, {
    description = 'view previous',
    group = 'tag',
  }),
  awful.key({ modkey }, 'Right', awful.tag.viewnext, {
    description = 'view next',
    group = 'tag',
  }),
  awful.key({ modkey }, 'Escape', awful.tag.history.restore, {
    description = 'go back',
    group = 'tag',
  }),

  awful.key(
    { modkey },
    'j',
    function()
      awful.client.focus.byidx(1)
    end,
    {
      description = 'focus next by index',
      group = 'client',
    }
  ),
  awful.key(
    { modkey },
    'k',
    function()
      awful.client.focus.byidx(-1)
    end,
    {
      description = 'focus previous by index',
      group = 'client',
    }
  ),

  -- Layout manipulation
  awful.key(
    { modkey, 'Shift' },
    'j',
    function()
      awful.client.swap.byidx(1)
    end,
    {
      description = 'swap with next client by index',
      group = 'client',
    }
  ),
  awful.key(
    { modkey, 'Shift' },
    'k',
    function()
      awful.client.swap.byidx(-1)
    end,
    {
      description = 'swap with previous client by index',
      group = 'client',
    }
  ),
  awful.key(
    { modkey, 'Control' },
    'j',
    function()
      awful.screen.focus_relative(1)
    end,
    {
      description = 'focus the next screen',
      group = 'screen',
    }
  ),
  awful.key(
    { modkey, 'Control' },
    'k',
    function()
      awful.screen.focus_relative(-1)
    end,
    {
      description = 'focus the previous screen',
      group = 'screen',
    }
  ),
  awful.key({ modkey }, 'u', awful.client.urgent.jumpto, {
    description = 'jump to urgent client',
    group = 'client',
  }),
  awful.key(
    { modkey },
    'Tab',
    function()
      awful.client.focus.history.previous()
      if client.focus then
        client.focus:raise()
      end
    end,
    {
      description = 'go back',
      group = 'client',
    }
  ),

  -- Standard program
  awful.key(
    { modkey },
    'Return',
    function()
      awful.spawn(terminal)
    end,
    {
      description = 'open a terminal',
      group = 'launcher',
    }
  ),
  awful.key({ modkey, 'Control' }, 'r', awesome.restart, {
    description = 'reload awesome',
    group = 'awesome',
  }),
  awful.key({ modkey, 'Shift' }, 'q', awesome.quit, {
    description = 'quit awesome',
    group = 'awesome',
  }),
  awful.key(
    { modkey },
    'l',
    function()
      awful.tag.incmwfact(0.01)
    end,
    {
      description = 'increase master width factor',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey },
    'h',
    function()
      awful.tag.incmwfact(-0.01)
    end,
    {
      description = 'decrease master width factor',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey, 'Shift' },
    'h',
    function()
      awful.tag.incnmaster(1, nil, true)
    end,
    {
      description = 'increase the number of master clients',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey, 'Shift' },
    'l',
    function()
      awful.tag.incnmaster(-1, nil, true)
    end,
    {
      description = 'decrease the number of master clients',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey, 'Control' },
    'h',
    function()
      awful.tag.incncol(1, nil, true)
    end,
    {
      description = 'increase the number of columns',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey, 'Control' },
    'l',
    function()
      awful.tag.incncol(-1, nil, true)
    end,
    {
      description = 'decrease the number of columns',
      group = 'layout',
    }
  ),
  awful.key(
    { modkey },
    'p',
    function()
      awful.spawn('/usr/bin/rofi -show drun -modi window,drun')
    end,
    {
      description = 'launch rofi',
      group = 'launcher',
    }
  ),

  -- screenshots
  awful.key({           }, 'Print', captureScreenshot,
            { group = 'screenshot', description = 'capture a screenshot' }),
  awful.key({ 'Control' }, 'Print', captureScreenshotActiveWindow,
            { group = 'screenshot', description = 'capture a screenshot of the active window' }),
  awful.key({ 'Shift'   }, 'Print', captureScreenshotSelection,
            { group = 'screenshot', description = 'capture a screenshot of a selection' }),

  awful.key(
    { modkey, 'Control' },
    'n',
    function()
      local c = awful.client.restore()
      -- Focus restored client
      if c then
        client.focus = c
        c:raise()
      end
    end,
    {
      description = 'restore minimized',
      group = 'client',
    }
  )
)

clientkeys = gears.table.join(
  awful.key(
    { modkey },
    'f',
    function(c)
      c.fullscreen = not c.fullscreen
      c:raise()
    end,
    {
      description = 'toggle fullscreen',
      group = 'client',
    }
  ),
  awful.key(
    { modkey },
    'x',
    function(c)
      c:kill()
    end,
    {
      description = 'close',
      group = 'client',
    }
  ),
  awful.key({ modkey, 'Control' }, 'space', awful.client.floating.toggle, {
    description = 'toggle floating',
    group = 'client',
  }),
  awful.key(
    { modkey, 'Control' },
    'Return',
    function(c)
      c:swap(awful.client.getmaster())
    end,
    {
      description = 'move to master',
      group = 'client',
    }
  ),
  awful.key(
    { modkey },
    't',
    function(c)
      c.ontop = not c.ontop
    end,
    {
      description = 'toggle keep on top',
      group = 'client',
    }
  ),
  awful.key(
    { modkey },
    'n',
    function(c)
      -- The client currently has the input focus, so it cannot be
      -- minimized, since minimized clients can't have the focus.
      c.minimized = true
    end,
    {
      description = 'minimize',
      group = 'client',
    }
  ),
  awful.key(
    { modkey },
    'm',
    function(c)
      c.maximized = not c.maximized
      c:raise()
    end,
    {
      description = '(un)maximize',
      group = 'client',
    }
  )
)

local function focusTag(name)
  local screen = awful.screen.focused()
  local tag = awful.tag.find_by_name(screen, name)

  tag:view_only()
end

local function moveClientToTag(name)
  if client.focus then
    local tag = awful.tag.find_by_name(client.focus.screen, name)

    client.focus:move_to_tag(tag)
  end
end

globalkeys = gears.table.join(
  globalkeys,
  awful.key({ modkey }, '#10', function() focusTag('Main') end,
            { group = 'tag', description = 'focus `Main` tag' }),
  awful.key({ modkey }, '#11', function() focusTag('Browse') end,
            { group = 'tag', description = 'focus `Browse` tag' }),
  awful.key({ modkey }, '#12', function() focusTag('Dev') end,
            { group = 'tag', description = 'focus `Dev` tag' }),
  awful.key({ modkey }, '#13', function() focusTag('Vidya') end,
            { group = 'tag', description = 'focus `Vidya` tag' }),
  awful.key({ modkey }, '#14', function() focusTag('League') end,
            { group = 'tag', description = 'focus `League` tag' }),
  awful.key({ modkey, 'Shift' }, '#10', function() moveClientToTag('Main') end,
            { group = 'tag', description = 'move focused client to `Main` tag' }),
  awful.key({ modkey, 'Shift' }, '#11', function() moveClientToTag('Browse') end,
            { group = 'tag', description = 'move focused client to `Browse` tag' }),
  awful.key({ modkey, 'Shift' }, '#12', function() moveClientToTag('Dev') end,
            { group = 'tag', description = 'move focused client to `Dev` tag' }),
  awful.key({ modkey, 'Shift' }, '#13', function() moveClientToTag('Vidya') end,
            { group = 'tag', description = 'move focused client to `Vidya` tag' }),
  awful.key({ modkey, 'Shift' }, '#14', function() moveClientToTag('League') end,
            { group = 'tag', description = 'move focused client to `League` tag' })
)

clientbuttons = gears.table.join(
  awful.button({}, 1, function(c)
    client.focus = c
    c:raise()
  end),
  awful.button({ modkey }, 1, awful.mouse.client.move),
  awful.button({ modkey }, 3, awful.mouse.client.resize)
)

-- Set keys
root.keys(globalkeys)

-- }}}

-- {{{ Rules - applied to new clients (through the "manage" signal)

awful.rules.rules = {

  -- all clients will match this rule
  {
    rule = {},
    properties = {
      focus = awful.client.focus.filter,
      raise = true,
      keys = clientkeys,
      buttons = clientbuttons,
      size_hints_honor = false, -- Remove gaps between terminals
      screen = awful.screen.preferred,
      callback = awful.client.setslave,
      placement = awful.placement.no_overlap + awful.placement.no_offscreen,
    },
  },

  -- add titlebars to normal clients and dialogs
  {
    rule_any = { type = { 'normal', 'dialog' } },
    properties = {
      titlebars_enabled = true
    },
  },

  -- floating clients
  {
    rule_any = {
      -- e.g. Google Chrome's (detached) Developer Tools.
      role = { 'pop-up' },
    },
    properties = {
      floating = true,
    },
  },

  -- Vidya clients
  {
    rule_any = {
      name = {
        'Lutris',
        'League of Legends',
        'Blizzard Battle.net',
        'Discord',
      },
    },
    properties = {
      floating = true,
      tag = 'Vidya',
    },
  },

  -- League of Legends game client
  {
    rule = { name = 'League of Legends (TM) Client' },
    properties = {
      tag = 'League',
      fullscreen = true,
      floating = true,
      focus = true,
      ontop = true,
      titlebars_enabled = false,
      requests_no_titlebar = true,
      switch_to_tags = true,
      size_hints_honor = true,
    },
    callback = awful.client.setmaster,
  },
}

-- {{{ Signals

-- Signal function to execute when a new client appears.
client.connect_signal('manage', function(c)
  -- Set the windows at the slave,
  -- i.e. put it at the end of others instead of setting it master.
  -- if not awesome.startup then awful.client.setslave(c) end

  if awesome.startup and not c.size_hints.user_position and not c.size_hints.program_position then
    -- Prevent clients from being unreachable after screen count changes.
    awful.placement.no_offscreen(c)
  end
end)

-- Add a titlebar if titlebars_enabled is set to true in the rules.
client.connect_signal('request::titlebars', function(c)
  local left_titlebar = awful.titlebar(c, {
    bg_normal = beautiful.border_normal,
    bg_focus = beautiful.border_focus,
    size = beautiful.border_width,
    position = 'left',
  })

  local top_titlebar = awful.titlebar(c, {
    bg_normal = beautiful.border_normal,
    bg_focus = beautiful.border_focus,
    size = beautiful.border_width,
  })
end)

client.connect_signal('property::maximized', function(c)
  if c.maximized then
    awful.titlebar.hide(c, 'top')
    awful.titlebar.hide(c, 'left')
  else
    awful.titlebar.show(c, 'top')
    awful.titlebar.show(c, 'left')
  end
end)

-- }}}

awful.spawn.with_shell('~/.config/awesome/autorun.sh')
