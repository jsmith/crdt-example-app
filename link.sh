DIR=$(dirname $0)
echo $DIR

rm -f $DIR/client/src/shared
rm -f $DIR/server/src/shared
ln -s ../../shared $DIR/client/src/shared
ln -s ../../shared $DIR/server/src/shared
