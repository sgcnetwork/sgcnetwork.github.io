-- Keep the private BABM media bucket within the current Free plan file limit.
update storage.buckets set file_size_limit = 52428800 where id = 'babm-community-images';
