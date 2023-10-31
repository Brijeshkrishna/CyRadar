from flask import Flask
from flask import render_template
import random
from flask import Flask, request
import pandas as pd
import tensorflow as tf
import tensorflow_hub as hub
import numpy as np

import nltk
from nltk.corpus import stopwords

import emoji
import re
from sklearn.pipeline import Pipeline

MAX_LENGTH =  50
MAX_CURRENCY_FLAG = 2
MAX_SPAM_WORDS = 1
MAX_EMOJI = 2
MAX_CONATANS = 1
MAX_EMAIL= 1
MAX_PHONE = 1


class RemoveStopWordsPunctuation:
    def fit(self, x, y=None):
        return self

    def __remove_punctuation_stopwords(self, text):
        pattern = re.compile("[{}]".format(re.escape("!\"#&'()*,-/:;<=>?[\\]^_`{|}~")))
        text = " ".join(
            [
                word.strip()
                for word in pattern.sub(" ", text.lower()).split()
                if word not in set(stopwords.words("english"))
            ]
        )
        return text

    def transform(self, df):
        df["Comment"] = df["Comment"].apply(self.__remove_punctuation_stopwords)
        return df


class AddLengthFlag:
    def fit(self, x, y=None):
        return self

    def transform(self, X):
        X["length"] = X["Comment"].str.len().astype(np.float32) / MAX_LENGTH
        return X


class AddCurrencyFlag:
    def __init__(self) -> None:
        self.currency_symbols = ["₤", "₨", "€", "₹", "₿", "$"]
        self.pattern = "([\$₤₨€₹₿]+ *[0-9]* *[\.,]?[0-9]*)|([0-9]* *[\.,]?[0-9]* *[\$₤₨€₹₿]+)"

    def fit(self, x, y=None):
        return self

    def __add_currency_count(self, text):
        return len(re.findall(self.pattern, text)) / MAX_CURRENCY_FLAG

    # def __add_currency_count(self,text):
    #     return sum(text.count(symbol) for symbol in self.currency_symbols )

    def transform(self, df):
        df["currency"] = df["Comment"].apply(self.__add_currency_count).astype(np.float32)
        return df


class AddSpamWordsFlag:
    def __init__(self) -> None:
        self.spam_words = [
            "morning",
            "good"
            "urgent",
            "exclusive",
            "limited time",
            "free",
            "guaranteed",
            "act now",
            "discount",
            "special offer",
            "prize",
            "instant",
            "cash",
            "save",
            "win",
            "best",
            "secret",
            "incredible",
            "congratulations",
            "approved",
            "risk free",
            "hidden",
            "bonus",
            "sale",
            "amazing",
            "extra cash",
            "opportunity",
            "easy",
            "double your",
            "best price",
            "cash back",
            "deal",
            "earn",
            "money",
            "no obligation",
            "profit",
            "results",
            "exciting",
            "unbelievable",
            "jackpot",
            "fantastic",
            "instant access",
            "million dollars",
            "discounted",
            "last chance",
            "exclusive offer",
            "big savings",
            "limited offer",
            "free trial",
            "special promotion",
            "secret revealed",
            "valuable",
            "money-back guarantee",
            "lowest price",
            "save money",
            "make money",
            "no risk",
            "exclusive deal",
            "limited supply",
            "huge",
            "incredible offer",
            "prize winner",
            "earn extra income",
            "limited spots",
            "new offer",
            "best deal",
            "don't miss out",
            "great savings",
            "top offer",
            "double your income",
            "discount code",
            "fast cash",
            "top-rated",
            "best value",
            "no cost",
            "elite",
            "act fast",
            "unbeatable",
            "cash prize",
            "limited availability",
            "special discount",
            "quick cash",
            "no catch",
            "instant approval",
            "big discount",
            "easy money",
            "insider",
            "invitation",
            "free shipping",
            "huge discount",
            "extra income",
            "secret formula",
            "no strings attached",
            "money-making",
            "dream come true",
            "massive",
            "free gift",
            "incredible opportunity",
            "risk-free trial",
            "instant money",
            "special price",
            "no purchase necessary",
            "now",
        ]

    def fit(self, x, y=None):
        return self

    def __add_currency_count(self, text):
        return float(sum(text.count(symbol) for symbol in self.spam_words) / MAX_SPAM_WORDS)

    def transform(self, df):
        df["spam_word"] = df["Comment"].apply(self.__add_currency_count).astype(np.float32)
        return df


class AddEmojiFlag:
    def __init__(self) -> None:
        self.emoji_symbols = "[💭|🔝|🆗|🎉|🎊|📯|🙌|😂|💸|👉|📢|🚀|💲|💣|🔱|💼|🆙|⏳|✨|💌|💎|🆕|🔞|💡|💰|👑|⭐|🌟|🎤|⚡|📈|💵|🏆|💪|🔓|🆓|🎰|⌚|🚨|💢|📮|🔥|🎈|🎥|🔔|💯|🎶|🔗|🎁|📚|🔊|👍|👏|📱|📝|🤑|🏅|🔒|📣|💥]"

    def fit(self, x, y=None):
        return self

    def __add_currency_count(self, text):
        return float(len(re.findall(self.emoji_symbols, text)) / MAX_EMOJI)

    def transform(self, df):
        df["emoji"] = df["Comment"].apply(self.__add_currency_count).astype(np.float32)
        return df


class AddContainFlag:
    def fit(self, x, y=None):
        return self

    def __add_first_count(self, text):
        pattern = "[0-9]*%|T&C"
        return len(re.findall(pattern, text))

    def __add_second_count(self, text):
        pattern = "(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z0-9]{2,}(\.[a-zA-Z0-9]{2,})(\.[a-zA-Z0-9]{2,})?"
        return len(re.findall(pattern, text))

    def transform(self, df):
        df["contain"] = df["Comment"].apply(self.__add_first_count)
        df["contain"] = df["contain"] + df["Comment"].apply(self.__add_second_count)
        df['contain'] = df['contain'].astype(np.float32) / MAX_CONATANS
        return df


class AddEmailFlag:
    def fit(self, x, y=None):
        return self

    def __add_email_count(self, text):
        pattern = "[\w]+@[\w]+\.\w+"
        return float(len(re.findall(pattern, text))  /MAX_EMAIL)

    def transform(self, df):
        df["email"] = df["Comment"].apply(self.__add_email_count).astype(np.float32)
        return df


class AddPhoneFlag:
    def fit(self, x, y=None):
        return self

    def __add_phone_no_count(self, text):
        pattern = "\+?[0-9]?[0-9]? ?0?[0-9]{10}"
        return len(re.findall(pattern, text))

    def __add_phone_no_count_1(self, text):
        pattern = "\+?[0-9]?\d{3}[ -]?\d{3}[ -]?\d{4}"
        return len(re.findall(pattern, text))

    def transform(self, df):
        df["phone"] = df["Comment"].apply(self.__add_phone_no_count)
        df["phone"] = df["phone"] + df["Comment"].apply(self.__add_phone_no_count_1)
        df["phone"] = df["phone"].astype(np.float32) / MAX_PHONE


        return df


class RemovePhoneLinkEmail:
    def fit(self, x, y=None):
        return self

    def __remove(self, text):
        text = re.sub("\$[0-9]*([\.,][0-9]{2})*\$?", "", text)
        text = re.sub("\+?[0-9]?[0-9]? ?0?[0-9]{10}", "", text)
        text = re.sub("\+?[0-9]?\d{3}[ -]?\d{3}[ -]?\d{4}", "", text)
        text = re.sub(
            r"(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z0-9]{2,}(\.[a-zA-Z0-9]{2,})(\.[a-zA-Z0-9]{2,})?",
            "",
            text,
        )
        text = re.sub(r"[\w]+@[\w]+\.\w+", "", text)
        text = emoji.replace_emoji(text)
        return text

    def transform(self, df):
        df["Comment"] = df["Comment"].apply(self.__remove)
        return df


class LemmatizeText:
    def __init__(self):
        self.lemmatizer = nltk.WordNetLemmatizer()

    def fit(self, X, y=None):
        return self

    def __lemmatize_text(self, text):
        return " ".join(
            [self.lemmatizer.lemmatize(word) for word in re.split("\W+", text)]
        ).strip()

    def transform(self, df):
        df["Comment"] = df["Comment"].map(lambda text: self.__lemmatize_text(text))
        return df



pipe =  Pipeline([

    ("AddCurrencyFlag",AddCurrencyFlag()),
    ("AddSpamWordsFlag",AddSpamWordsFlag()),
    ("AddEmojiFlag",AddEmojiFlag()),
    ("AddContainFlag",AddContainFlag()),
    ("AddEmailFlag",AddEmailFlag()),
    ("AddPhoneFlag",AddPhoneFlag()),

    ("RemovePhoneLinkEmail",RemovePhoneLinkEmail()),
    ("RemoveStopWordsPunctuation",RemoveStopWordsPunctuation()),

    ("LemmatizeText",LemmatizeText()),

    ("AddLengthFlag",AddLengthFlag()),


])
model = tf.keras.models.load_model('spam-model.h5', custom_objects={'KerasLayer':hub.KerasLayer})

def precidt(msg):
    if type(msg) is str:
        df = pd.DataFrame([msg],columns=["Comment"])
    elif type(msg) is list:
        df = pd.DataFrame(msg,columns=["Comment"])
    else:
        return []

    df = pipe.transform(df)
    table = df
    df = {
        "Comment": tf.convert_to_tensor(df["Comment"],dtype=tf.string),
        "Length": tf.convert_to_tensor(df["length"], dtype=tf.float32),
        "Currency": tf.convert_to_tensor(df["currency"], dtype=tf.float32),
        "Spam Words": tf.convert_to_tensor(df["spam_word"], dtype=tf.float32),
        "Emoji": tf.convert_to_tensor(df["emoji"], dtype=tf.float32),
        "Contain": tf.convert_to_tensor(df["contain"], dtype=tf.float32),
        "Email": tf.convert_to_tensor(df["email"], dtype=tf.float32),
        "Phone": tf.convert_to_tensor(df["phone"], dtype=tf.float32)
    }
    return [ i  for i in model.predict(df).reshape(-1,) ],table



app = Flask(__name__,template_folder="templates")

@app.route("/")
def hello():
    return render_template('index.html')


@app.route("/api/data", methods=["POST"])
def main():
    data = request.get_json()['text']

    value = precidt(data)[0]

    if (value > 85):
        score =  "Poor"

    elif (value >50):
        score = "Okay"

    else:
        score = "Great"

    return {"value": "{:.2f} % Spam".format(value) , "score" : "<span class='text-poor'>{score}</span>"}


app.run()

