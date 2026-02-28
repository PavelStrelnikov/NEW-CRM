# SPT Usage Examples

Real-world examples of using the Speech Processing Test pipeline.

## Basic Examples

### Example 1: Russian Technician → Hebrew Ticket

**Scenario**: Technician calls in about camera issues at client site

**Input Audio** (Russian speech):
```
"Так, короче, вчера был у Когана на объекте, там система видеонаблюдения
глючит, ну короче три камеры работают нормально, а остальные показывают
черный экран. Я проверял все кабели, вроде целые. Подозреваю что регистратор
умер, но пока не уверен. Клиент очень недоволен, потому что это уже второй
раз за месяц."
```

**Command**:
```bash
python app/main.py audio_samples/kogan_cameras.mp3 -o he
```

**Expected Output**:
```
📍 Detected Language: RU

🎤 RAW TRANSCRIPT
────────────────────────────────────────────────────────────
Так, короче, вчера был у Когана на объекте, там система видеонаблюдения
глючит, ну короче три камеры работают нормально, а остальные показывают
черный экран. Я проверял все кабели, вроде целые. Подозреваю что регистратор
умер, но пока не уверен. Клиент очень недоволен, потому что это уже второй
раз за месяц.

🌐 TRANSLATED TEXT (HE)
────────────────────────────────────────────────────────────
אז בקיצור, אתמול הייתי אצל כהן באתר, שם מערכת המעקב מקלקלת,
כלומר שלוש מצלמות עובדות תקין, והשאר מציגות מסך שחור. בדקתי את
כל הכבלים, כנראה תקינים. אני חושד שהרשמקול מת, אבל עדיין לא
בטוח. הלקוח מאוד לא מרוצה כי זה כבר פעם שנייה בחודש.

✅ NORMALIZED TICKET TEXT (HE)
────────────────────────────────────────────────────────────
לקוח: כהן
תקלה: תקלה במערכת המעקב
פרטים: 3 מצלמות עובדות תקין, יתר המצלמות מציגות מסך שחור.
בדיקה: כבלים נבדקו - תקינים.
חשד: תקלה ב-NVR.
הערה: תקלה חוזרת - אירוע שני בחודש האחרון.
```

---

### Example 2: Hebrew Technician → Hebrew Ticket (No Translation)

**Scenario**: Local technician reports alarm malfunction

**Input Audio** (Hebrew speech):
```
"שלום, אני כרגע אצל משה בפיצריה ברמת גן. המערכת אזעקה פה משוגעת,
כל הזמן צופצפת בלי סיבה. החיישן ליד הדלת האחורית כנראה התקלקל.
בדקתי את הסוללה, היא בסדר. צריך להחליף את החיישן."
```

**Command** (keep original language):
```bash
python app/main.py audio_samples/moshe_alarm.mp3 --no-force-translate
```

**Expected Output**:
```
📍 Detected Language: HE

🎤 RAW TRANSCRIPT
────────────────────────────────────────────────────────────
שלום, אני כרגע אצל משה בפיצריה ברמת גן. המערכת אזעקה פה משוגעת,
כל הזמן צופצפת בלי סיבה. החיישן ליד הדלת האחורית כנראה התקלקל.
בדקתי את הסוללה, היא בסדר. צריך להחליף את החיישן.

✅ NORMALIZED TICKET TEXT (HE)
────────────────────────────────────────────────────────────
לקוח: פיצרייה ברמת גן (משה)
תקלה: מערכת אזעקה מפעילה התראות שווא
פרטים: חיישן בדלת אחורית גורם לצפצופים מתמשכים ללא סיבה נראית לעין.
בדיקה: סוללת החיישן תקינה.
נדרש: החלפת חיישן.
```

---

### Example 3: Russian Technician → Russian Ticket

**Scenario**: Network equipment failure

**Input Audio** (Russian speech):
```
"Слушай, был у клиента на Дизенгоф 15, офис на третьем этаже. Свитч вообще
не работает, индикаторы не горят. Попробовал другой блок питания - та же
фигня. Короче похоже что железо сдохло, надо менять. Это Cisco SG300,
8-портовый."
```

**Command** (output in Russian):
```bash
python app/main.py audio_samples/dizengoff_switch.mp3 -o ru
```

**Expected Output**:
```
📍 Detected Language: RU

🎤 RAW TRANSCRIPT
────────────────────────────────────────────────────────────
Слушай, был у клиента на Дизенгоф 15, офис на третьем этаже. Свитч вообще
не работает, индикаторы не горят. Попробовал другой блок питания - та же
фигня. Короче похоже что железо сдохло, надо менять. Это Cisco SG300,
8-портовый.

✅ NORMALIZED TICKET TEXT (RU)
────────────────────────────────────────────────────────────
Клиент: офис на Дизенгоф 15, 3 этаж
Проблема: неисправен сетевой коммутатор
Детали: отсутствуют световые индикаторы на коммутаторе Cisco SG300 (8 портов).
Проверка: замена блока питания не помогла.
Вывод: аппаратная неисправность коммутатора.
Требуется: замена оборудования.
```

---

## Advanced Examples

### Example 4: Verbose Mode (Debugging)

**Use case**: Debug issues with transcription or translation

**Command**:
```bash
python app/main.py audio_samples/test.mp3 -v
```

**Output** (includes debug logs):
```
2026-02-07 10:15:32 - INFO - Loaded .env from tools/spt/.env
2026-02-07 10:15:33 - INFO - Initialized SpeechToTextService with model: gemini-2.0-flash-exp
2026-02-07 10:15:33 - INFO - Initialized TranslationService with model: gemini-2.0-flash-exp
2026-02-07 10:15:33 - DEBUG - Loaded prompt for ru: 1543 chars
2026-02-07 10:15:33 - DEBUG - Loaded prompt for he: 1621 chars
2026-02-07 10:15:33 - INFO - Initialized TicketNormalizationService with model: gemini-2.0-flash-exp
2026-02-07 10:15:33 - INFO - Pipeline initialized: output_language=he, force_translation=True
...
```

---

### Example 5: Using Different Model

**Use case**: Test with more powerful or specialized model

**Command**:
```bash
python app/main.py audio_samples/test.mp3 -m gemini-pro
```

---

### Example 6: Text-Only Testing (No Audio)

**Use case**: Rapid testing of normalization prompts without audio files

**Command**:
```bash
python test_text_only.py
```

**Output**:
```
================================================================================
TEXT-ONLY NORMALIZATION TEST
================================================================================

================================================================================
TEST 1: Russian technician report (cameras)
================================================================================

📝 ORIGINAL TEXT:
────────────────────────────────────────────────────────────
Так короче был на объекте у Когана вчера, там камеры глючат опять...

🔧 NORMALIZING (language: ru)...

✅ NORMALIZED OUTPUT:
────────────────────────────────────────────────────────────
Клиент: Коган
Проблема: неисправность камер видеонаблюдения
Детали: ...

🌐 TRANSLATING TO HEBREW...
────────────────────────────────────────────────────────────
לקוח: כהן
תקלה: ...
...
```

---

## Real-World Scenarios

### Scenario A: Multiple Issues in One Call

**Input**: Technician mentions 2 problems in one audio message

```
"Привет, был у Левина. Там две проблемы: первое - камера на входе не
показывает, кабель оборван кажется. Второе - в офисе WiFi вообще не
ловит, точка доступа моргает красным."
```

**Expected Normalized Output**:
```
Клиент: Левин
Проблема 1: камера на входе не работает
Детали: отсутствует изображение, вероятно поврежден кабель.

Проблема 2: отсутствует WiFi в офисе
Детали: точка доступа индицирует ошибку (красный индикатор).
```

---

### Scenario B: Urgent Issue with Client Escalation

**Input**: Technician reports urgent issue with dissatisfied client

```
"Срочно! У Абрамова на складе полностью упала сеть, весь бизнес стоит.
Роутер вообще мертвый, даже не включается. Клиент в бешенстве, требует
немедленного решения. Нужна замена железа прямо сейчас."
```

**Expected Normalized Output**:
```
Клиент: Абрамов (склад)
Срочность: ВЫСОКАЯ
Проблема: полный отказ сетевого оборудования
Детали: маршрутизатор не включается, сеть недоступна. Бизнес-процессы остановлены.
Требуется: срочная замена оборудования.
Статус клиента: критическое недовольство.
```

---

### Scenario C: Follow-up Visit

**Input**: Technician returns to previously reported issue

```
"Снова у Когана, помнишь были проблемы с камерами на прошлой неделе?
Поменял регистратор, вроде все заработало. Но клиент жалуется что
запись теперь не по расписанию идет, а постоянно. Надо настроить."
```

**Expected Normalized Output**:
```
Клиент: Коган
Связано с: тикет от [дата] - замена NVR
Текущая проблема: неправильные настройки записи
Детали: после замены регистратора запись идёт непрерывно вместо записи по расписанию.
Требуется: перенастройка параметров записи.
```

---

## Comparison: Before vs After Normalization

### Before (Raw Speech)
```
"Ну короче э-э-э был там у этого как его Мойши на Алленби ну типа
пекарня, короче у него там камеры того не пишут ну то есть типа
картинка есть но на диск не идет короче вот, я проверял кабели и все
такое вроде норм, хз че с региком может порты или че"
```

### After (Normalized)
```
לקוח: פיצרייה ברח' אלנבי (מוישה)
תקלה: מצלמות אינן מקליטות
פרטים: תמונה חיה קיימת, אך אין שמירה לדיסק.
בדיקה: כבלים תקינים.
חשד: תקלה ב-NVR או בפורטים.
```

**Key improvements**:
- ✅ Removed filler words ("ну", "короче", "э-э-э")
- ✅ Structured format
- ✅ Technical clarity
- ✅ Preserved all facts
- ✅ Professional tone
- ✅ Translated to target language

---

## Edge Cases

### Edge Case 1: Very Short Audio
```bash
python app/main.py audio_samples/short.mp3
# Input: "У Левина свитч не работает"
# Output: Minimal but complete ticket
```

### Edge Case 2: Noisy Audio
```bash
python app/main.py audio_samples/noisy.mp3 -v
# May require multiple attempts or audio cleanup
```

### Edge Case 3: Mixed Language Audio
```bash
python app/main.py audio_samples/mixed.mp3
# System detects primary language
# May struggle with heavy code-switching
```

---

## Performance Examples

### Small Audio (15 seconds)
- Transcription: ~2 seconds
- Translation: ~1 second
- Normalization: ~1 second
- **Total**: ~4 seconds

### Medium Audio (60 seconds)
- Transcription: ~5 seconds
- Translation: ~2 seconds
- Normalization: ~2 seconds
- **Total**: ~9 seconds

### Large Audio (5 minutes)
- Transcription: ~15 seconds
- Translation: ~3 seconds
- Normalization: ~3 seconds
- **Total**: ~21 seconds

---

**Note**: All examples are illustrative. Actual results depend on:
- Audio quality
- Speech clarity
- Gemini API performance
- Prompt effectiveness
- Network latency
