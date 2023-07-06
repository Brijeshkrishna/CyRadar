# %%
import numpy as np
import pandas as pd


import tensorflow as tf
import tensorflow_hub as hub

import nltk
from nltk.corpus import stopwords

import emoji
import re
from sklearn.pipeline import Pipeline

from sklearn.model_selection import train_test_split
import datetime
from imblearn.over_sampling import RandomOverSampler

# %%
MAX_LENGTH =  50
MAX_CURRENCY_FLAG = 2
MAX_SPAM_WORDS = 1
MAX_EMOJI = 2
MAX_CONATANS = 1
MAX_EMAIL= 1
MAX_PHONE = 1

# %%
df1 = pd.read_csv("./datasets/sms.csv",delimiter=',')
df2 = pd.read_csv("datasets/yt.csv",delimiter=',')
df3 = pd.read_csv("datasets/my-collection.csv",delimiter=',')
df4 = pd.read_csv("datasets/spam-word.csv",delimiter=',')
df5 = pd.read_csv("datasets/emoji.csv",delimiter=',')


df = pd.concat([df1,df2,df3,df4,df5],ignore_index=True)

# %%
# import seaborn as sns
# sns.countplot(x="Spam",data=df)


# %%
class UpSample:
    def fit(self, x, y=None):
        return self

    def transform(self, df):
        ros = RandomOverSampler(random_state=73133)

        x, y = ros.fit_resample(
            df[['Comment','currency','length','spam_word','emoji','contain','email','phone',]].values
            ,df['Spam'].values
        )
        df =  pd.DataFrame(x, columns=['Comment','currency','length','spam_word','emoji','contain','email','phone'])
        df['Spam'] = y
        return  df

class ConvertData:
    def fit(self, x, y=None):
        return self

    def transform(self, df):
        df = df.drop_duplicates()
        df = df.dropna()
        df["Spam"] = df["Spam"].astype(bool)
        df["Comment"] = df["Comment"].astype(str)
        return df


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

# %%


pipe =  Pipeline([
    ("ConvertData",ConvertData()),
    

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
    ("UpSample",UpSample())


])


# %%
df = pipe.transform(df)
df.info()


# %%
# import seaborn as sns
# sns.countplot(x="currency",data=df)
# sns.countplot(x="spam_word",data=df)
# sns.countplot(x="emoji",data=df)
# sns.countplot(x="contain",data=df)
# sns.countplot(x="email",data=df)
# sns.countplot(x="phone",data=df)
# sns.countplot(x="length",data=df)

# df

# %%
y = pd.DataFrame(df.Spam)
x = df.drop(["Spam"],axis=1)

# %%
x_train,x_test,y_train,y_test=train_test_split(x,y,train_size=0.8,test_size=0.2,random_state=0)

# X_train=[tf.convert_to_tensor( x_train["Comment"], dtype=tf.string ) ,tf.convert_to_tensor(x_train["length"],dtype=tf.float32),tf.convert_to_tensor(x_train["currency"],dtype=tf.float32) , tf.convert_to_tensor(x_train["spam_word"],dtype=tf.float32) ,tf.convert_to_tensor( x_train["emoji"],dtype=tf.float32 ),tf.convert_to_tensor( x_train["contain"],dtype=tf.float32),tf.convert_to_tensor( x_train["email"],dtype=tf.float32), tf.convert_to_tensor(x_train["phone"],dtype=tf.float32)]
# X_test=[tf.convert_to_tensor( x_test["Comment"],dtype=tf.string ) ,tf.convert_to_tensor(x_test["length"],dtype=tf.float32),tf.convert_to_tensor(x_test["currency"],dtype=tf.float32) , tf.convert_to_tensor(x_test["spam_word"],dtype=tf.float32) ,tf.convert_to_tensor( x_test["emoji"] ,dtype=tf.float32),tf.convert_to_tensor( x_test["contain"],dtype=tf.float32),tf.convert_to_tensor( x_test["email"],dtype=tf.float32), tf.convert_to_tensor(x_test["phone"],dtype=tf.float32)]
# X_train=[x_train["Comment"].to_list(),x_train["length"].to_list(),x_train["currency"].to_list() , x_train["spam_word"].to_list() , x_train["emoji"].to_list() , x_train["contain"].to_list(), x_train["email"].to_list(), x_train["phone"].to_list()]
# X_test= [x_test["Comment"].to_list(), x_test["length"].to_list(),x_test["currency"].to_list() , x_test["spam_word"].to_list() , x_test["emoji"].to_list() , x_test["contain"].to_list(), x_test["email"].to_list(), x_test["phone"].to_list()]

# X_train=[x_train["Comment"],x_train["length"],x_train["currency"] , x_train["spam_word"] , x_train["emoji"] , x_train["contain"], x_train["email"], x_train["phone"]]
# X_test=[ x_test["Comment"], x_test["length"],x_test["currency"] , x_test["spam_word"] , x_test["emoji"] , x_test["contain"], x_test["email"], x_test["phone"]]

# %%
X_train = {
    "Comment": tf.convert_to_tensor(x_train["Comment"]),
    "Length": tf.convert_to_tensor(x_train["length"], dtype=tf.float32),
    "Currency": tf.convert_to_tensor(x_train["currency"], dtype=tf.float32),
    "Spam Words": tf.convert_to_tensor(x_train["spam_word"], dtype=tf.float32),
    "Emoji": tf.convert_to_tensor(x_train["emoji"], dtype=tf.float32),
    "Contain": tf.convert_to_tensor(x_train["contain"], dtype=tf.float32),
    "Email": tf.convert_to_tensor(x_train["email"], dtype=tf.float32),
    "Phone": tf.convert_to_tensor(x_train["phone"], dtype=tf.float32)
}

X_test={
    "Comment": tf.convert_to_tensor(x_test["Comment"]),
    "Length": tf.convert_to_tensor(x_test["length"], dtype=tf.float32),
    "Currency": tf.convert_to_tensor(x_test["currency"], dtype=tf.float32),
    "Spam Words": tf.convert_to_tensor(x_test["spam_word"], dtype=tf.float32),
    "Emoji": tf.convert_to_tensor(x_test["emoji"], dtype=tf.float32),
    "Contain": tf.convert_to_tensor(x_test["contain"], dtype=tf.float32),
    "Email": tf.convert_to_tensor(x_test["email"], dtype=tf.float32),
    "Phone": tf.convert_to_tensor(x_test["phone"], dtype=tf.float32)
}

y_train = { "Spam" : tf.convert_to_tensor(y_train,dtype=tf.bool) }
y_test = { "Spam" : tf.convert_to_tensor(y_test,dtype=tf.bool) }


# %%

# class LayerHelper(tf.keras.layers.Layer):
#     def __init__(self, name1 ,name2 ,units1 = 8 ,units2 = 8 , dropout_rate=0.5 ):
#         super(LayerHelper, self).__init__()
#         self.dense1 = tf.keras.layers.Dense(units1, , name=name1)
#         self.dropout = tf.keras.layers.Dropout(dropout_rate)
#         self.dense2 = tf.keras.layers.Dense(units2, , name=name2 )

#     def call(self, inputs):
#         x = self.dense1(inputs)
#         x = self.dropout(x)
#         x = self.dense2(x)
#         return x



# class Comment(tf.keras.layers.Layer):
#     def __init__(self):
#         super(Comment, self).__init__()

#         self.url = "https://tfhub.dev/google/nnlm-en-dim50/2"

#         self.hub_layer = hub.KerasLayer(self.url, dtype=tf.string, trainable=True,name="NNLM_Hub")        
        
#         self.set1= LayerHelper(name1="Comment_Dense_set_1",name2="Comment_Dense_set_1_out",units1=125000,units2=2500,dropout_rate=0.2)
#         self.set2 = LayerHelper(name1="Comment_Dense_set_2",name2="Comment_Dense_set_2_out",units1=2500,units2=1250,dropout_rate=0.3)
#         self.set3 = LayerHelper(name1="Comment_Dense_set_3",name2="Comment_Dense_set_3_out",units1=1250,units2=MAX_LENGTH,dropout_rate=0.3)
        
#     def call(self, inputs):

#         x = self.hub_layer(inputs)
#         x = self.set1(x)
#         x = self.set2(x)
#         x = self.set3(x)

#         return x




# %%

string_input = tf.keras.layers.Input(shape=[], dtype=tf.string , name="Comment")
length_input   = tf.keras.layers.Input(shape=(1,),name="Length",dtype=tf.float32)
currency_input = tf.keras.layers.Input(shape=(1,),name="Currency",dtype=tf.float32)
spam_word_input = tf.keras.layers.Input(shape=(1,),name="Spam Words",dtype=tf.float32)
emoji_input = tf.keras.layers.Input(shape=(1,),name="Emoji",dtype=tf.float32)
contain_input = tf.keras.layers.Input(shape=(1,),name="Contain",dtype=tf.float32)
email_input = tf.keras.layers.Input(shape=(1,),name="Email",dtype=tf.float32)
phone_input = tf.keras.layers.Input(shape=(1,),name="Phone",dtype=tf.float32)

#Comment
hub_layer = hub.KerasLayer("https://tfhub.dev/google/nnlm-en-dim50/2", dtype=tf.string, trainable=True,name="NNLM_Hub")
embedding_layer = hub_layer(string_input)

s1= tf.keras.layers.Dense(2500)(embedding_layer)
s1= tf.keras.layers.LeakyReLU()(s1)

s1 = tf.keras.layers.Dense(2000)(s1)
s1= tf.keras.layers.LeakyReLU()(s1)

s1 = tf.keras.layers.Dense(1500)(s1)
s1= tf.keras.layers.LeakyReLU()(s1)

s1 = tf.keras.layers.Dense(1000)(s1)
s1= tf.keras.layers.LeakyReLU()(s1)

s1 = tf.keras.layers.Dense(500)(s1)
s1= tf.keras.layers.LeakyReLU()(s1)



length_layer = tf.keras.layers.Dense(256,name="length_layer")(length_input)
length_layer = tf.keras.layers.LeakyReLU()(length_layer)

length_layer = tf.keras.layers.Dense(120,name="length_layer1")(length_layer)
length_layer = tf.keras.layers.LeakyReLU()(length_layer)



currency_layer = tf.keras.layers.Dense(256, name="currency_layer")(currency_input)
currency_layer = tf.keras.layers.LeakyReLU()(currency_layer)

# currency_layer = tf.keras.layers.Dropout(0.5)(currency_layer)
currency_layer = tf.keras.layers.Dense(66, name="currency_layer1")(currency_layer)
currency_layer = tf.keras.layers.LeakyReLU()(currency_layer)


# currency_layer = tf.keras.layers.Average(name="currency_avg")(currency_layer)

spam_word_layer = tf.keras.layers.Dense(256, name="spam_word_layer")(spam_word_input)
spam_word_layer = tf.keras.layers.LeakyReLU()(spam_word_layer)

# spam_word_layer = tf.keras.layers.Dropout(0.5)(spam_word_layer)
spam_word_layer = tf.keras.layers.Dense(101, name="spam_word_layer1")(spam_word_layer)
spam_word_layer = tf.keras.layers.LeakyReLU()(spam_word_layer)


emoji_layer = tf.keras.layers.Dense(256, name="emoji_layer")(emoji_input)
emoji_layer = tf.keras.layers.LeakyReLU()(emoji_layer)

# emoji_layer = tf.keras.layers.Dropout(0.5)(emoji_layer)
emoji_layer = tf.keras.layers.Dense(62, name="emoji_layer1")(emoji_layer)
emoji_layer = tf.keras.layers.LeakyReLU()(emoji_layer)

# emoji_layer = tf.keras.layers.Average(name="emoji_avg")(emoji_layer)

contain_layer = tf.keras.layers.Dense(256, name="conatian_layer")(contain_input)
contain_layer = tf.keras.layers.LeakyReLU()(contain_layer)

# contain_layer = tf.keras.layers.Dropout(0.5)(contain_layer)
contain_layer = tf.keras.layers.Dense(256, name="conatian_layer1")(contain_layer)
contain_layer = tf.keras.layers.LeakyReLU()(contain_layer)

# contain_layer = tf.keras.layers.Average(name="conatain_avg")(contain_layer)

email_layer = tf.keras.layers.Dense(256, name="email_layer")(email_input)
email_layer = tf.keras.layers.LeakyReLU()(email_layer)

# email_layer = tf.keras.layers.Dropout(0.5)(email_layer)
email_layer = tf.keras.layers.Dense(54, name="email_layer1")(email_layer)
email_layer = tf.keras.layers.LeakyReLU()(email_layer)

# email_layer = tf.keras.layers.Average(name="email_avg")(email_layer)

phone_layer = tf.keras.layers.Dense(256, name="phone_layer")(phone_input)
phone_layer = tf.keras.layers.LeakyReLU()(phone_layer)

# phone_layer = tf.keras.layers.Dropout(0.5)(phone_layer)
phone_layer = tf.keras.layers.Dense(112, name="phone_layer1")(phone_layer)
phone_layer = tf.keras.layers.LeakyReLU()(phone_layer)

# phone_layer = tf.keras.layers.Average(name="phone_avg")(phone_layer)


concat_layer_level1_1 = tf.keras.layers.concatenate([length_layer,currency_layer,spam_word_layer])
concat_layer_level1_1 = tf.keras.layers.Dense(300)(concat_layer_level1_1)
concat_layer_level1_1 = tf.keras.layers.LeakyReLU()(concat_layer_level1_1)



concat_layer_level1_2 = tf.keras.layers.concatenate([contain_layer,emoji_layer,email_layer,phone_layer])
concat_layer_level1_2 = tf.keras.layers.Dense(300)(concat_layer_level1_2)
concat_layer_level1_2 = tf.keras.layers.LeakyReLU()(concat_layer_level1_2)


concat_layer_level = tf.keras.layers.concatenate([concat_layer_level1_1,concat_layer_level1_2])
sub_layer = tf.keras.layers.Dense(300,name="sub_layer")(concat_layer_level)
sub_layer = tf.keras.layers.LeakyReLU()(sub_layer)

# con  = tf.keras.layers.Dropout(rate=0.2)(sub_layer)

# Concatenate all input branches
concat_layer = tf.keras.layers.concatenate([s1,sub_layer ])

# Add dense and output layers
f1= tf.keras.layers.Dense(1000)(concat_layer)
f1 = tf.keras.layers.LeakyReLU()(f1)

f1 = tf.keras.layers.Dense(500)(f1)
f1 = tf.keras.layers.LeakyReLU()(f1)

f1 = tf.keras.layers.Dense(250)(f1)
f1 = tf.keras.layers.LeakyReLU()(f1)

f1 = tf.keras.layers.Dense(150)(f1)
f1 = tf.keras.layers.LeakyReLU()(f1)


output_layer = tf.keras.layers.Dense(1,activation='sigmoid',name="Spam")(f1)


# Create the model
model = tf.keras.Model(inputs=[string_input, length_input,currency_input,spam_word_input,emoji_input,contain_input,email_input,phone_input], outputs=output_layer)

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
model.summary()

#67248

# %%
# model.save("base.model")

# %%
# import graphviz

# # Plot the model
# # plot_model(model, to_file='team_strength_model.png', show_shapes=1, expand_nested=1,show_layer_activations=1)

# # Load the graphviz object from the file
# graph = graphviz.Source.from_file('team_strength_model.png',encoding='latin1' )
# # # Modify the style to make the center box more prominent
# # graph.graph['node'][0]['width'] = '2'
# # graph.graph['node'][0]['style'] = 'filled'
# # graph.graph['node'][0]['fillcolor'] = 'lightblue'

# # Save the modified graph
# graph.render(filename='team_strength_model_with_center_box', format='png', cleanup=True)


# %%
# import matplotlib.pyplot as plt
# from tensorflow.keras.utils import plot_model

# # Plot model
# plot_model(model, to_file='team_strength_model.png',show_shapes=1,expand_nested=1,show_layer_activations=1)

# # Display the image
# data = plt.imread('team_strength_model.png')
# plt.imshow(data)

# %%

log_dir = f"logs/fit_{datetime.datetime.now()}/" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
tensorboard_callback = tf.keras.callbacks.TensorBoard(log_dir=log_dir, histogram_freq=1)


# %%
import gc
class MyCustomCallback(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        gc.collect()
        tf.keras.backend.clear_session()

# %%

k = model.fit(X_train,
          y_train,
          epochs=2,
          batch_size=12,
          validation_data=(X_test, y_test),
          callbacks=[MyCustomCallback(),tf.keras.callbacks.EarlyStopping(monitor='val_loss', mode='min', verbose=1, patience=10),tensorboard_callback],
          verbose=1
)




# %%


# %%

# string_input = tf.keras.layers.Input(shape=[], dtype=tf.string , name="Comment")
# length_input   = tf.keras.layers.Input(shape=(1,),name="Length",dtype=tf.float32)
# currency_input = tf.keras.layers.Input(shape=(1,),name="Currency",dtype=tf.float32)
# spam_word_input = tf.keras.layers.Input(shape=(1,),name="Spam Words",dtype=tf.float32)
# emoji_input = tf.keras.layers.Input(shape=(1,),name="Emoji",dtype=tf.float32)
# contain_input = tf.keras.layers.Input(shape=(1,),name="Contain",dtype=tf.float32)
# email_input = tf.keras.layers.Input(shape=(1,),name="Email",dtype=tf.float32)
# phone_input = tf.keras.layers.Input(shape=(1,),name="Phone",dtype=tf.float32)

# #Comment
# hub_layer = hub.KerasLayer("https://tfhub.dev/google/nnlm-en-dim50/2", dtype=tf.string, trainable=True,name="NNLM_Hub")
# embedding_layer = hub_layer(string_input)
# s1= tf.keras.layers.Dense(5000, activation='relu'  )(embedding_layer)
# drop1 = tf.keras.layers.Dropout(0)(s1)
# s1= tf.keras.layers.Dense(4000, activation='relu'  )(s1)
# s1= tf.keras.layers.Dense(3000, activation='relu'  )(s1)
# s2 = tf.keras.layers.Dense(2000, activation='relu')(s1)
# s3 = tf.keras.layers.Dense(1000, activation='relu')(s2)


# length_layer = tf.keras.layers.Dense(256, activation='relu',name="length_layer", )(length_input)
# length_layer = tf.keras.layers.Dropout(0)(length_layer)
# length_layer = tf.keras.layers.Dense(120, activation='relu',name="length_layer1",)(length_layer)


# currency_layer = tf.keras.layers.Dense(8, activation='relu',name="currency_layer")(currency_input)
# currency_layer = tf.keras.layers.Dropout(0)(currency_layer)
# currency_layer = tf.keras.layers.Dense(8, activation='relu',name="currency_layer1")(currency_layer)

# # currency_layer = tf.keras.layers.Average(name="currency_avg")(currency_layer)

# spam_word_layer = tf.keras.layers.Dense(8, activation='relu',name="spam_word_layer",)(spam_word_input)
# spam_word_layer = tf.keras.layers.Dropout(0)(spam_word_layer)
# spam_word_layer = tf.keras.layers.Dense(8, activation='relu',name="spam_word_layer1")(spam_word_layer)
# # spam_word_layer = tf.keras.layers.Average(name="spamword_avg")(spam_word_layer)

# emoji_layer = tf.keras.layers.Dense(8, activation='relu',name="emoji_layer", )(emoji_input)
# emoji_layer = tf.keras.layers.Dropout(0)(emoji_layer)
# emoji_layer = tf.keras.layers.Dense(8, activation='relu',name="emoji_layer1", )(emoji_layer)
# # emoji_layer = tf.keras.layers.Average(name="emoji_avg")(emoji_layer)

# contain_layer = tf.keras.layers.Dense(8, activation='relu',name="conatian_layer", )(contain_input)
# contain_layer = tf.keras.layers.Dropout(0)(contain_layer)
# contain_layer = tf.keras.layers.Dense(8, activation='relu',name="conatian_layer1", )(contain_layer)
# # contain_layer = tf.keras.layers.Average(name="conatain_avg")(contain_layer)

# email_layer = tf.keras.layers.Dense(8, activation='relu',name="email_layer", )(email_input)
# email_layer = tf.keras.layers.Dropout(0)(email_layer)
# email_layer = tf.keras.layers.Dense(8, activation='relu',name="email_layer1", )(email_layer)
# # email_layer = tf.keras.layers.Average(name="email_avg")(email_layer)

# phone_layer = tf.keras.layers.Dense(8, activation='relu',name="phone_layer", )(phone_input)
# phone_layer = tf.keras.layers.Dropout(0)(phone_layer)
# phone_layer = tf.keras.layers.Dense(8, activation='relu',name="phone_layer1", )(phone_layer)
# # phone_layer = tf.keras.layers.Average(name="phone_avg")(phone_layer)


# concat_layer_level1_1 = tf.keras.layers.concatenate([length_layer,currency_layer,spam_word_layer],name="SUB1")

# sub1 = tf.keras.layers.Dense(300, activation='relu')(concat_layer_level1_1)
# sub1 = tf.keras.layers.Dense(900, activation='relu' )(sub1)
# concat_layer_level1_1_dense = tf.keras.layers.Dense(300, activation='relu' )(sub1)

# concat_layer_level1_2 = tf.keras.layers.concatenate([contain_layer,emoji_layer,email_layer,phone_layer],name='sub2')

# sub2 = tf.keras.layers.Dense(300, activation='relu')(concat_layer_level1_2)
# sub2 = tf.keras.layers.Dense(900, activation='relu' )(sub2)
# concat_layer_level1_2_dense = tf.keras.layers.Dense(300, activation='relu' )(sub2)



# concat_layer_level = tf.keras.layers.concatenate([concat_layer_level1_1_dense,concat_layer_level1_2_dense])

# sub_layer = tf.keras.layers.Dense(900, activation='relu',name="sub_layer")(concat_layer_level)
# con  = tf.keras.layers.Dropout(rate=0)(sub_layer)


# # Concatenate all input branches
# concat_layer = tf.keras.layers.concatenate([s3,con ])

# # Add dense and output layers
# f1= tf.keras.layers.Dense(1000, activation='relu')(concat_layer)
# f2 = tf.keras.layers.Dense(1000, activation='relu' )(f1)

# f3 = tf.keras.layers.Dense(2000, activation='relu' )(f2)
# f4 = tf.keras.layers.Dense(1000, activation='relu' )(f3)
# f5 = tf.keras.layers.Dense(2000, activation='relu' )(f4)
# f6 = tf.keras.layers.Dense(750, activation='relu' )(f5)

# f7 = tf.keras.layers.Dense(500, activation='relu' )(f6)

# dense_layer = tf.keras.layers.Dense(100, activation='relu')(f7)

# output_layer = tf.keras.layers.Dense(1, activation='sigmoid',name="Spam")(dense_layer)

# # Create the model
# model = tf.keras.Model(inputs=[string_input, length_input,currency_input,spam_word_input,emoji_input,contain_input,email_input,phone_input], outputs=output_layer)

# model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
# model.summary()


