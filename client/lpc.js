var _anim_speed = 300;
var _commit_url = '';

function removeCommentsRowIfLastComment(comment) {
    var comments_container = $(comment).closest('.comments-wrapper');
    if ($(comments_container).children().length === 1) {
        $(comments_container).closest('tr').remove();
    }
}

function onCommentEditClicked() {
    var edit_comment_form = $('#templates .edit-comment-form').clone();
    var comment = $(this).closest('.comment');
    var comment_text = $('.comment-text', comment); // stores original markdown text
    var edit_textarea = $('textarea', edit_comment_form);
    var comment_html = $('.comment-html', comment);

    $(edit_textarea).val($(comment_text).html());
    $(this).closest('.header').after(edit_comment_form);
    $(edit_comment_form).hide();
    var edit_button = this;
    $(comment_html).slideUp(_anim_speed, function() {
        $(edit_button).fadeOut(_anim_speed);
        $(edit_comment_form).hide().slideDown(_anim_speed);
    });

    $('form', edit_comment_form).submit(function() {});

    $('.cancel-button', edit_comment_form).click(function() {
    $(edit_comment_form).slideUp(_anim_speed, function() {
        $(edit_button).fadeIn(_anim_speed);
        $(edit_comment_form).remove();
        $(comment_html).slideDown(_anim_speed);
    });
        return false;
    });

    $('.update-button', edit_comment_form).click(function() {
        var new_text = $(edit_textarea).val();
        var comment_id = $(this).closest('.comment').attr('comment-id');
        $.ajax({
            url: _commit_url + '/comments/' + comment_id,
            type: 'PUT',
            data: {'comment_text': new_text}
        }).success(function() {
            // update comment html
            var showdown = new Showdown.converter();
            $(comment_html).html(showdown.makeHtml(new_text));
            $(comment_text).html(new_text); // store original markdown text
            // hide the edit form
            $(edit_comment_form).slideUp(_anim_speed, function() {
                $(edit_button).fadeIn(_anim_speed);
                $(edit_comment_form).remove();
                // show the rendered html
                $(comment_html).slideDown(_anim_speed, function() {
                    // now show 'last edited' in header
                    $('.label', comment).show();
                    var edited = $('.edited-timestamp', comment);
                    $(edited).show().attr('datetime', new Date().getTime());
                    $(edited).timeago();
                });
            });
        }).error(function() {
            alert('error putting update');
        });
        return false;
    });

}

function onCommentDeleteClicked() {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    var comment = $(this).closest('.comment');
    $.ajax({
        url: _commit_url + '/comments/' + comment.attr('comment-id'),
        type: 'DELETE'
    }).success(function() {
        $(comment).slideUp(_anim_speed, function() {
            removeCommentsRowIfLastComment(comment);
            $(comment).remove();
        });
    }).error(function() {
        alert('problem deleting comment');
    });
}

function onCommentSubmitClicked() {
    var add_comment_form = $(this).closest('.add-comment-form');
    var comment_text = $('textarea[name="comment_text"]', add_comment_form).val();
    if (comment_text.length === 0) {
        // flash red or something? maybe better to disable this button
        // until there's text
        return false;
    }

    var comments_row = $(this).closest('.comments-row');
    var comment = {
        'file_idx': comments_row.attr('file_idx'),
        'row_idx': comments_row.attr('row_idx'),
        'comment_text': comment_text,
        'id': -1
    };

    $.post(_commit_url + '/comments', comment, function(data) {
        $(add_comment_form).slideUp(function() {
            var now = new Date().getTime();

            comment.id = data.lastID;
            comment.added_timestamp = now,
            comment.edited_timestamp = now,

            insertComments([comment]);

            $(add_comment_form).remove();
        });
    }).error(function() {
        alert('problem submitting comment');
    });

    return false;
}

// get the parent container for comments related to the commentable diff row
function getCommentsContainer(commentable_row) {

    // the parent container lives in a cell in the next row
    var comments_div = $('.comments-wrapper', commentable_row.next());
    if (comments_div.length !== 0) {
        return comments_div;
    }

    // nothing found - insert a new row to hold the comments
    var file = $(commentable_row).closest('.file');
    var file_idx = $('.file').index(file);
    var row_idx = $('.commentable', file).index($('.commentable', commentable_row));

    // TODO - templatize
    commentable_row.after('<tr class="comments-row" file_idx="' +
                                                file_idx +
                                                '" row_idx="' +
                                                row_idx +
                                                '"><td class="stripe" colspan=2></td><td class="comments"><div class="comments-wrapper"></div></td></tr>');

    return $('.comments-wrapper', commentable_row.next());
}

function onCommentableDblClicked() {
    var target_row = $(this).closest('tr');
    var comments_container = getCommentsContainer(target_row);

    var existing_form = $('.add-comment-form', comments_container);
    if (existing_form.length !== 0) {
        $('textarea', existing_form).focus();
        return;
    }

    var comment_form = $('#templates .add-comment-form').clone();

    // insert in the proper place (last) in the comments container
    if ($(comments_container).children().length === 0) {
        $(comments_container).html(comment_form);
    }
    else {
        $(comments_container).children().last().after(comment_form);
    }

    comment_form.hide().slideDown(_anim_speed, function() {
        $('textarea', comment_form).focus();
    });

    $('form', comment_form).submit(function() {
        // disable default submit behavior w/ page refresh
        return false;
    });

    // hook up comment form buttons
    $('.cancel-button', comment_form).click(function() {
        $(comment_form).slideUp(_anim_speed, function() {
            removeCommentsRowIfLastComment(comment_form);
            $(comment_form).remove();
        });
        return false;
        // don't reload page
    });

    $('.submit-button', comment_form).click(onCommentSubmitClicked);

    // clear any text selection after the double-click
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    else if (document.selection) {
        document.selection.empty();
    }
}

function insertComments(comments) {
    var showdown = new Showdown.converter();

    $.each(comments, function(idx, comment) {
        var file = $('#file_index_' + comment.file_idx);
        var commentable_row = $('.commentable', file).eq(comment.row_idx).parent();

        if (file.length === 0 || commentable_row.length === 0) {
            console.log('bad comment: ' + JSON.stringify(comment));
            return;
        }
        console.log(JSON.stringify(comment));
        var comments_container = getCommentsContainer(commentable_row);
        var comment_div = $('#templates .comment').clone();
        $(comment_div).attr('id', 'comment_id_' + comment.id);
        $(comment_div).attr('comment-id', comment.id);

        $('.comment-html', comment_div).html(showdown.makeHtml(comment.comment_text));
        $('.comment-text', comment_div).html(comment.comment_text); // save for editing
        $('.added-timestamp', comment_div).attr('datetime', comment.added_timestamp);
        if (comment.added_timestamp !== comment.edited_timestamp) {
            $('.label', comment_div).show();
            $('.edited-timestamp', comment_div).show().attr('datetime', comment.edited_timestamp).timeago();
        }
        else {
            $('.label', comment_div).hide();
            $('.edited-timestamp', comment_div).hide();
        }
        $('.added-timestamp', comment_div).timeago();
        $('.edit-button', comment_div).click(onCommentEditClicked);
        $('.delete-button', comment_div).click(onCommentDeleteClicked);

        // insert in the proper place in the comments container
        if ($(comments_container).children().length === 0) {
            $(comments_container).html(comment_div);
        }
        else {
            $(comments_container).children().last().after(comment_div);
        }

    });
}

// a highlightDiff callback to generate links in the .files-list div
function addFileLink(name1, name2, id, mode_change, old_mode, new_mode) {
    var img = document.createElement('img');
    var p = document.createElement('p');
    var link = document.createElement('a');
    link.setAttribute('href', '#' + id);
    p.appendChild(link);
    var finalFile = '';
    if (name1 == name2) {
        finalFile = name1;
        img.src = '/images/modified.png';
        img.title = 'Modified file';
        p.title = 'Modified file';
        if (mode_change)
        p.appendChild(document.createTextNode(' mode ' + old_mode + ' -> ' + new_mode));
    }
     else if (name1 == '/dev/null') {
        img.src = '/images/added.png';
        img.title = 'Added file';
        p.title = 'Added file';
        finalFile = name2;
    }
     else if (name2 == '/dev/null') {
        img.src = '/images/removed.png';
        img.title = 'Removed file';
        p.title = 'Removed file';
        finalFile = name1;
    }
     else {
        img.src = '/images/renamed.png';
        img.title = 'Renamed file';
        p.title = 'Renamed file';
        finalFile = name2;
        p.insertBefore(document.createTextNode(name1 + ' -> '), link);
    }

    link.appendChild(document.createTextNode(finalFile));
    link.setAttribute('representedFile', finalFile);

    p.insertBefore(img, link);
    $('.file-links').append(p);
}

function getCommitJSON() {
    // set global
    _commit_url = window.location.href.split('#')[0];

    $.getJSON(_commit_url + '?format=json', function(data) {
        $('.loading').hide();

        if (!data.git_show) {
            // TODO show proper error
            $('.loading').html('error loading commit - empty git show');
            return;
        }

        // populate info-bloc
        $('#sha').append(data.git_show.sha);
        $('#author-name-and-email').append(data.git_show['author-name-and-email']);

        var showdown = new Showdown.converter();
        $('#subject-and-body').append(showdown.makeHtml(data.git_show['subject-and-body']));

        $('#author-date').append(new Date(data.git_show['author-date'] * 1000).toLocaleString());

        // markup diff tables
        var highlighter = new DiffHighlighter.highlighter();
        highlighter.highlightDiff(data.git_show.diff, $('#diff-content').get(0), {'newfile': addFileLink});

        // bind double-clicking a row - add a form comment
        $('.diff .commentable').dblclick(onCommentableDblClicked);

        $('.info-block').fadeIn(_anim_speed);
        $('.file-links').fadeIn(_anim_speed);
        // $('.file-links a').click(function() {
        //     var id = $(this).attr('href');
        //     $(id).slideto({
        //             slide_duration: (_anim_speed * 3),
        //             highlight_duration: 3500
        //         });
        // })

        // add existing comments to the diff rows
        insertComments(data.comments);

        // use nice scrollTo plugin to animate scroll to hash & highlight
        $(window.location.hash).slideto({
            slide_duration: _anim_speed,
            highlight_duration: 4000
        });

    }).error(function(qXHR, textStatus, errorThrown) {
        $('.loading').html('error loading commit: ' + errorThrown);
    });
}
