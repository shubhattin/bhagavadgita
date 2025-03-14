CREATE TABLE "translations" (
	"lang_id" integer NOT NULL,
	"chapter_num" smallint NOT NULL,
	"index" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	CONSTRAINT "translations_lang_id_chapter_num_index_pk" PRIMARY KEY("lang_id","chapter_num","index")
);
