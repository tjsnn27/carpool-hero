# Carpool Hero — Staff User Guide

**Agasthiyar Academy Sunday School**

This guide is for the three staff roles in Carpool Hero. Share the section that matches each person’s job.

---

## Overview: One Sunday, Step by Step

Every student moves through the same status path:

| Order | Status shown in app | Who does it |
|------:|---------------------|-------------|
| 1 | **Not Checked In** | *(start of day)* |
| 2 | **In Class** | Hall Monitor or Traffic Controller — **Morning Check-In** |
| 3 | **In Class — Pickup Arrived** | Traffic Controller — **Traffic Control** (enter Student ID when car arrives) |
| 4 | **Released from Class** | Hall Monitor — **Board** (Release from Class) |
| 5 | **Loaded** | Traffic Controller — **Load into Pickup vehicle** |

```text
Not Checked In → In Class → Pickup Arrived → Released from Class → Loaded
     (morning)      (morning)   (car at lane)    (hall monitor)      (in car)
```

**Student ID** — Each child has a 1–5 digit ID on their placard (same as the CSV **StudentID** column). Traffic Control and Morning Check-In use this number.

**Pickup locations** (Traffic Control only):

- Lane 1  
- Lane 2  
- Walker - Front  
- Walker - Back  

---

## Role 1: Hall Monitor

**Your job:** Check kids in when they arrive, watch the dismissal board, and release students from class when their ride is waiting.

### Screens you use

| Tab | Purpose |
|-----|---------|
| **Morning Check-In** | Mark students **In Class** when dropped off |
| **Board** | See waiting cars and release students from class |

### Morning — drop-off

1. Open **Morning Check-In**.
2. When a student arrives, either:
   - Enter their **Student ID** on the keypad and tap ✓, or  
   - Find them in the **Not checked in** list (alphabetical) and tap **Check In**.
3. Status changes to **In Class**.

### Afternoon — dismissal

1. Open **Board**.
2. When a new car appears (chime / TTS optional), note the **Student ID**, family name, and **Pickup** location.
3. Find the student on the card. Status should be **In Class — Pickup Arrived** (set by Traffic Control when the car checked in).
4. Tap **Release from Class** for that student.
5. Status becomes **Released from Class**. Traffic Control will mark **Loaded** when the child is in the vehicle.

**Tips**

- Use the grade filter if you only want to see certain classes.  
- You cannot release a student until pickup has arrived.  
- You do not mark students loaded — that is Traffic Control only.

---

## Role 2: Traffic Controller

**Your job:** Check in students in the morning (if needed), register cars at pickup, and confirm when each child is in the vehicle.

### Screens you use

| Tab | Purpose |
|-----|---------|
| **Morning Check-In** | Same as Hall Monitor — optional if hall monitors handle all drop-offs |
| **Traffic Control** | Enter Student ID when car arrives; mark **Loaded** when child is in car |

### Morning — drop-off (optional)

Same steps as Hall Monitor on **Morning Check-In**.

### Afternoon — pickup lane

1. Open **Traffic Control**.
2. Select the correct **pickup location** (Lane 1, Lane 2, Walker - Front, or Walker - Back).
3. When the driver arrives, enter the **Student ID** from the placard and tap ✓.
   - The family joins the live queue.
   - The student’s status becomes **In Class — Pickup Arrived**.
   - Hall Monitor sees them on the **Board**.
4. Under **Active pickups**, when a student shows **Released from Class**, tap **Load into Pickup vehicle**.
5. When all students in that car are loaded, the entry leaves the active queue.

**Tips**

- **Undo** removes the last check-in if entered by mistake (most recent waiting entry only).  
- QR scan mode is available via the camera button if placards have QR codes.  
- A student must be **In Class** (morning check-in done) before lane check-in works.

---

## Role 3: Admin

**Your job:** Set up roster and placards, manage settings, and start a new Sunday session.

### Signing in

1. Sign in with your school Microsoft account (production), or choose **Admin** in the demo **View as** menu.  
2. Open **Admin Login** in the nav.  
3. Enter the admin password and tap **Unlock Admin**.  
4. Roster, Tags, Zone, and Admin settings tabs appear after unlock.

*Password is provided by your carpool coordinator. Demo password: `10205`.*

### Screens you use (after unlock)

| Tab | Purpose |
|-----|---------|
| **Morning Check-In** | Can check in students like other roles |
| **Traffic Control** | Can run the lane like Traffic Controller |
| **Board** | Can view / release like Hall Monitor |
| **Roster** | View all students; import CSV |
| **Tags** | Link Student IDs to families |
| **Zone** | Pickup zone map settings |
| **Admin** | Restart Sunday session |

### Import roster (CSV)

Required columns:

```text
StudentID,StudentFirstName,FamilyName,GradeRoom
```

Example:

```text
10049,Madhumitha,J,Grade 2(Tamil)
10035,Jishna,A,Grade 1(Tamil)
```

Upload under **Roster → CSV Import**. Comma or tab separated.

### Placard tags (Tags screen)

- Each **Student ID** maps to one family placard.  
- Add authorized pickup names and safety notes per family.  
- Sibling families share one ID if configured on the same family record.

### Start a new Sunday

**Admin → Restart Sunday Session**

- Enter the admin password.  
- All students reset to **Not Checked In**.  
- Pickup queue is cleared.  

The app also **auto-resets on the first use each Sunday**.

Use this at the start of dismissal day or if you need to clear a practice run.

### Export attendance (save today's attendance)

- Open **Morning Check-In**.
- In the top-right click **Export CSV** or **Export Excel** to download today's attendance snapshot.
- Files are named `attendance-YYYY-MM-DD.csv` or `attendance-YYYY-MM-DD.xlsx`.
- Columns included: **StudentID**, **FirstName**, **LastName**, **Grade**, **Family**, **Status** (status values: `not_checked_in`, `in_class`, `pickup_arrived`, `released_from_class`, `loaded`, `absent`).
- CSV is a plain, comma-quoted file; Excel is a single-sheet `.xlsx` workbook named **Attendance**.
- Recommended: download and store the file for your records at the end of the morning check-in period or before dismissal, so you have a preserved copy of which students attended that day.

---

## Quick reference by role

| Action | Hall Monitor | Traffic Controller | Admin |
|--------|:------------:|:------------------:|:-----:|
| Morning check-in | ✓ | ✓ | ✓ |
| Enter Student ID at pickup | | ✓ | ✓ |
| Release from class | ✓ | | ✓ |
| Load into vehicle | | ✓ | ✓ |
| Import roster / tags | | | ✓ (unlocked) |
| Restart Sunday session | | | ✓ (unlocked) |

---

## Live updates & connection

- **● Live** (green) — board and queue update automatically.  
- **○ Offline / Reconnecting** — wait or refresh; do not duplicate check-ins until live again.

---

## Demo mode (training)

If you see **Mock** in the header, use the **View as** dropdown to switch personas:

- **Admin** — full access after Admin Login  
- **Traffic Controller** — Morning Check-In + Traffic Control  
- **Hall Monitor** — Morning Check-In + Board  

Practice the full flow with sample Student IDs such as `10049`, `10035`, or `10055`.

---

## Who to contact

- **Roster / Student ID issues** — Admin  
- **Wrong car or queue** — Traffic Controller (Undo) + Admin if needed  
- **Password / access** — Admin coordinator  

*Carpool Hero — Agasthiyar Academy*
