# Original Specification
Note: This is a personal learning experience note for the author and owner of this codebase, all handwritten by human. AI Agents strictly must not reference, touch, or edit this file. 

---

# Japanese Language Web App

The goal of this web app is to allow easy access to dictionary-like but easy to read, lightweight, fast, and does not require login. 

The reference that can be used is https://japanese.thetinywisdom.com/ and https://jisho.org/


## Feature List
Below are the list of feature that needs to be implemented.

### Feature 1 - Verb List
1. The verb list is simple, high-density, and easy to read, similar to an excel file or a cheatsheet
2. The verb list is searchable
3. The verb list is filterable and has an indicator of JLPT N levels, type of verb (godan/ichidan, ru ending or not, transitive or not), is it a common verb or not
4. The verb list uses Kanji with furigana and hiragana/katakana, and also shows the English translation
5. Clicking a verb will open the verb detail 


### Feature 2 - Verb Detail
1. The verb detail page contains all information above, alongside all conjugation of the verb, and example sentences with translation
2. The verb detail also shows the kanji breakdown 


### Feature 3 - Verb conjugation quiz
1. There is a quiz function similar to https://japanese.thetinywisdom.com/verbs
2. The user can select the level, conjugation type, and verb type 
3. The user can select the session length and how much question will be displayed
4. The quiz will show a verb, and the user needs to guess the conjugation. The shown verb and conjugation answer is randomed. For example, taberu might be shown, and user is questioned what is the conjugation for past negative, and the answer is tabenakatta.
5. When doing the quiz, there will be 2 type of question, both of which can be selected in the beginning. If both selected, the type will be chosen at random. The first is input mode, the second is multiple option mode. Input mode will always turn the input into kana, regardless of latin or kana keyboard, and user will need to input the answer. Multiple option will show different conjugation for the verb, and user needs to select the correct conjugation.
6. After selecting the answer, directly display the answer, the meaning, and a cheatsheet on how to conjugate each verb type for that conjugation answer.



## Planned Feature List
Below are the list of planned feature that will be added along the way, so the infrastructure and code needs to support it.

### Planned Feature 1 - Vocabulary
1. There will be a similar type as verb, but with Vocabulary. This covers nouns, adjectives, and adverbs of every day things. Specific or niche things such as names, or specific bridge like Tokyo Rainbow Bridge will not be saved, but rather the generic object itself, like Bridge, Suspension Bridge, and more.
2. The  list will be similar, which have the translation, kanji, furigana, kana, tags and indicator such as JLPT N level, type of vocabulary (noun/adjective/adverb), how common it is, and more.


### Planned Feature 2 - Vocabulary Quiz
1. There will be a similar quiz as verb, but for vocabulary. User can select whether to learn adjectives, adverbs, or anything similar.


### Planned Feature 3 - Kanji List
1. The user can view a kanji detail and where it is used. User can click the kanji from other feature above, and it will go into the kanji detail page, which is part of this list.



## Infrastructure
1. The website should be lightweight as possible, using the most efficient framework and as little libraries as possible.
2. As there is no login or data saved, all data will be saved using cache locally, including progress such as accuracy, day streak, how many verbs have been learned, how many time the verb has been seen, and how many session has been done in the browser. The cached data can be downloaded and imported to other browser easily.
3. The list of data, such as vocabulary and verb list, will not be stored in a DB, but using a lightweight file such as JSON and will be stored in the codebase. The JSON structure must support all feature above, including planned feature. Data access must be fast, as small of size as possible, and as little loading as possible.
4. The JSON data should be easily modified and configured, by human or by AI, so it is easy to adjust, add, or remove data.



## Design Decision
1. The design should be minimal, clean, and high-density, but still have spacing to allow ease of use. 
2. There will be animation used, but at max must be 150ms to retain the fastness of it.
3. The design supports light and dark mode.
4. Design must be responsive but mobile first, but highly optimized also for desktop.







