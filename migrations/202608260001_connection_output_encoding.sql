ALTER TABLE connections
ADD COLUMN output_encoding TEXT NOT NULL DEFAULT 'utf8'
CHECK(output_encoding IN ('utf8', 'gb2312', 'gbk', 'gb18030'));
